import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SerializeAddon } from "@xterm/addon-serialize";
import { SearchAddon } from "@xterm/addon-search";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ImageAddon } from "@xterm/addon-image";
import { useConfig } from "@/features/settings/useConfigStore";
import { resolveTheme, toXtermTheme } from "@/themes";
import { buildShortcutString } from "@/shared/utils/keybindings";
import { useClipboardStore } from "@/features/clipboard/useClipboardStore";
export interface TerminalCacheEntry {
  term: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  unsubData: () => void;
  unsubExit: () => void;
  onExit?: ((terminalId: string) => void) | undefined;
  webglAddon?: WebglAddon | null | undefined;
  imageAddon?: ImageAddon | null | undefined;
}

export const terminalCache = new Map<string, TerminalCacheEntry>();

export function destroyTerminalCache(terminalId: string) {
  const entry = terminalCache.get(terminalId);
  if (entry) {
    entry.unsubData();
    entry.unsubExit();
    window.serializeAddons?.delete(terminalId);
    if (entry.webglAddon) entry.webglAddon.dispose();
    if (entry.imageAddon) entry.imageAddon.dispose();
    entry.term.dispose();
    terminalCache.delete(terminalId);
  }
}

interface UseTerminalOptions {
  terminalId: string;
  isActive: boolean;
  isFocused?: boolean | undefined;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onExit?: ((terminalId: string) => void) | undefined;
  onFocus?: (() => void) | undefined;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
}

export function useTerminal({
  terminalId,
  isActive,
  isFocused,
  containerRef,
  onExit,
  onFocus,
  isSearchOpen,
  setIsSearchOpen,
}: UseTerminalOptions) {
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [searchAddon, setSearchAddon] = useState<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const { config } = useConfig();
  const configRef = useRef(config);
  configRef.current = config;

  const isSearchOpenRef = useRef(isSearchOpen);
  isSearchOpenRef.current = isSearchOpen;

  const webglAddonRef = useRef<WebglAddon | null>(null);
  const imageAddonRef = useRef<ImageAddon | null>(null);

  // 1. Initialize and mount terminal
  useEffect(() => {
    const api = window.terminalApi;
    if (!api) return;

    const container = containerRef.current;
    if (!container) return;

    let term: Terminal;
    let fitAddon: FitAddon;
    let sAddon: SearchAddon;

    const entry = terminalCache.get(terminalId);

    if (!entry) {
      const themeObj = toXtermTheme(
        resolveTheme(config.theme, config.customThemes),
        typeof config.opacity === "number" ? config.opacity : undefined,
      );

      term = new Terminal({
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        cursorBlink: config.cursorBlink,
        cursorStyle: config.cursorStyle,
        allowProposedApi: true,
        allowTransparency: true,
        scrollback: config.virtualScrollbackEnabled
          ? config.virtualScrollbackBufferSize || 1000
          : 100000,
        theme: themeObj,
      });

      fitAddon = new FitAddon();
      const serializeAddon = new SerializeAddon();
      sAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(serializeAddon);
      term.loadAddon(sAddon);

      const urlPathRegex =
        /(?:https?:\/\/[^\s]+)|(?:(?:[a-zA-Z]:[\\/]+|\/)?(?:[\w.-]+[\\/]+)+[\w.-]+(?::\d+)?)/;
      term.loadAddon(
        new WebLinksAddon(
          (_event, uri) => {
            if (uri.startsWith("http://") || uri.startsWith("https://")) {
              window.windowApi?.openExternal?.(uri);
            } else {
              const match = uri.match(/^(.+?)(?::(\d+))?$/);
              if (match) {
                window.workspaceApi?.revealPath?.(match[1]!);
              }
            }
          },
          {
            urlRegex: urlPathRegex,
            hover: () => {
              document.body.style.cursor = "pointer";
            },
            leave: () => {
              document.body.style.cursor = "";
            },
          },
        ),
      );

      try {
        const imageAddon = new ImageAddon({
          sixelSupport: true,
          sixelScrolling: true,
          enableSizeReports: true,
        });
        term.loadAddon(imageAddon);
        imageAddonRef.current = imageAddon;
      } catch (e) {
        console.warn("Failed to load ImageAddon", e);
      }

      term.open(container);

      if (config.webglEnabled) {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            console.warn(
              "WebGL context lost, disposing addon to fallback to canvas renderer",
            );
            webglAddon.dispose();
            webglAddonRef.current = null;
            const ent = terminalCache.get(terminalId);
            if (ent) ent.webglAddon = null;
          });
          term.loadAddon(webglAddon);
          webglAddonRef.current = webglAddon;
        } catch (e) {
          console.warn("WebGL addon failed to load, falling back to canvas", e);
        }
      }

      if (!window.serializeAddons) {
        window.serializeAddons = new Map();
      }
      window.serializeAddons.set(terminalId, serializeAddon);

      // Fetch history (mainly useful when detaching to a new window)
      let oldestTimestamp = Date.now();
      let isFetchingHistory = false;
      let hasMoreHistory = true;
      let initialWriteDone = false;

      api
        .getHistory(terminalId)
        .then((res: any) => {
          let historyData = "";
          if (typeof res === "string") {
            historyData = res;
          } else if (res && typeof res === "object") {
            historyData = res.data || "";
            if (res.oldestTimestamp) oldestTimestamp = res.oldestTimestamp;
          }

          if (historyData) {
            term.write(historyData, () => {
              initialWriteDone = true;
            });
          } else {
            initialWriteDone = true;
          }
        })
        .catch(() => {
          initialWriteDone = true;
        });

      term.onScroll(async (scrollPos) => {
        if (!initialWriteDone) return;
        if (
          !config.virtualScrollbackEnabled ||
          isFetchingHistory ||
          !hasMoreHistory ||
          scrollPos > 10
        )
          return;

        isFetchingHistory = true;
        try {
          const apiHist = (window as any).historyApi;
          if (!apiHist) return;

          const chunks = await apiHist.getScrollbackChunk(
            terminalId,
            oldestTimestamp,
          );
          if (chunks && chunks.length > 0) {
            oldestTimestamp = chunks[0].timestamp;

            const serializeAddon = window.serializeAddons?.get(terminalId);
            if (serializeAddon) {
              const currentData = serializeAddon.serialize();
              const oldData = chunks.map((c: any) => c.data).join("");

              const linesAdded = (oldData.match(/\n/g) || []).length;

              term.reset();
              term.write(oldData + currentData, () => {
                term.scrollToLine(linesAdded + scrollPos);
              });
            }
          } else {
            hasMoreHistory = false;
          }
        } catch (err) {
          console.error("Failed to fetch history", err);
        } finally {
          isFetchingHistory = false;
        }
      });

      // Enable forwarding immediately so PTY output flows to xterm
      api.enableForwarding(terminalId).catch(() => {});

      const unsubData = api.onData((pId, data) => {
        if (pId === terminalId) {
          term.write(data);
        }
      });

      const unsubExit = api.onExit((pId, exitCode) => {
        if (pId === terminalId) {
          term.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
          const curEntry = terminalCache.get(terminalId);
          curEntry?.onExit?.(terminalId);
        }
      });

      term.onData((data) => {
        api.write(terminalId, data);
      });

      term.onResize(({ cols, rows }) => {
        api.resize(terminalId, cols, rows);
      });

      const newEntry: TerminalCacheEntry = {
        term,
        fitAddon,
        searchAddon: sAddon,
        unsubData,
        unsubExit,
        onExit,
        webglAddon: webglAddonRef.current,
        imageAddon: imageAddonRef.current,
      };
      terminalCache.set(terminalId, newEntry);
    } else {
      entry.onExit = onExit as any;
      term = entry.term;
      fitAddon = entry.fitAddon;
      sAddon = entry.searchAddon;
      webglAddonRef.current = entry.webglAddon || null;
      imageAddonRef.current = entry.imageAddon || null;

      if (term.element) {
        container.appendChild(term.element);
      } else {
        term.open(container);
      }
    }

    setTerminal(term);
    setSearchAddon(sAddon);
    fitAddonRef.current = fitAddon;

    // Initial fit after open or reparent
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });

    const handleFocusIn = () => onFocus?.();
    container.addEventListener("focusin", handleFocusIn);

    // Shortcuts via xterm attachCustomKeyEventHandler
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === "keydown") {
        if (e.key === "Escape" && isSearchOpenRef.current) {
          setIsSearchOpen(false);
          return false;
        }

        const shortcut = buildShortcutString(e);
        if (!shortcut) return true;

        if (shortcut === "ctrl+backspace") {
          window.terminalApi?.write(terminalId, "\x17");
          return false;
        }

        const action = (configRef.current.keybindings || {})[shortcut];

        if (action === "terminal:search") {
          if (isSearchOpenRef.current) {
            setIsSearchOpen(false);
            term?.focus();
          } else {
            setIsSearchOpen(true);
          }
          return false;
        } else if (action === "terminal:copy") {
          const sel = term.getSelection();
          if (sel) {
            navigator.clipboard.writeText(sel).catch(() => {});
            useClipboardStore.getState().add(sel);
          }
          return false;
        } else if (action === "terminal:paste") {
          navigator.clipboard
            .readText()
            .then((text) => window.terminalApi?.write(terminalId, text))
            .catch(() => {});
          return false;
        } else if (action && !action.startsWith("terminal:")) {
          return true;
        }
      }
      return true;
    });

    let resizeTimeout: ReturnType<typeof setTimeout>;

    function doFit() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
        } catch {
          // ignore
        }
      }, 50);
    }

    const resizeObserver = new ResizeObserver(doFit);
    resizeObserver.observe(container);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      container.removeEventListener("focusin", handleFocusIn);
    };
  }, [terminalId, containerRef]);

  // 2. Fit when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // ignore
        }
      });
    }
  }, [isActive]);

  // 3. Focus when isFocused becomes true
  useEffect(() => {
    if (isFocused && terminal) {
      terminal.focus();
    }
  }, [isFocused, terminal]);

  // 4. Focus when sidebar closes
  useEffect(() => {
    if (!config.sidebarOpen && isFocused && terminal) {
      terminal.focus();
    }
  }, [config.sidebarOpen, isFocused, terminal]);

  // 5. Dynamically update terminal options when config changes
  useEffect(() => {
    if (terminal) {
      const themeObj = toXtermTheme(
        resolveTheme(config.theme, config.customThemes),
        typeof config.opacity === "number" ? config.opacity : undefined,
      );

      terminal.options.fontFamily = config.fontFamily;
      terminal.options.fontSize = config.fontSize;
      terminal.options.cursorBlink = config.cursorBlink;
      terminal.options.cursorStyle = config.cursorStyle as any;
      terminal.options.theme = themeObj;
      terminal.options.scrollback = config.virtualScrollbackEnabled
        ? config.virtualScrollbackBufferSize || 1000
        : 100000;

      if (config.webglEnabled && !webglAddonRef.current) {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
            webglAddonRef.current = null;
            const entry = terminalCache.get(terminalId);
            if (entry) entry.webglAddon = null;
          });
          terminal.loadAddon(webglAddon);
          webglAddonRef.current = webglAddon;
          const entry = terminalCache.get(terminalId);
          if (entry) entry.webglAddon = webglAddon;
        } catch (e) {
          console.warn("Failed to enable WebGL", e);
        }
      } else if (!config.webglEnabled && webglAddonRef.current) {
        webglAddonRef.current.dispose();
        webglAddonRef.current = null;
        const entry = terminalCache.get(terminalId);
        if (entry) entry.webglAddon = null;
      }
    }
  }, [config, terminal, terminalId]);

  return { terminal, searchAddon, fitAddon: fitAddonRef.current };
}
