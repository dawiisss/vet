import { Suspense, lazy } from "react";
import { useUIStore } from "@/shared/stores/useUIStore";
import { useTabStore } from "@/features/terminal/useTabStore";
import { useConfig } from "@/features/settings/useConfigStore";
import { getNode } from "@/features/terminal/splitTree";
import { builtinThemes } from "@/themes";

const SettingsModal = lazy(
  () => import("@/features/settings/components/SettingsModal"),
);
const AboutModal = lazy(() => import("@/shared/components/AboutModal"));
const UpdateModal = lazy(() => import("@/shared/components/UpdateModal"));
const HistoryViewerModal = lazy(
  () => import("@/shared/components/HistoryViewerModal"),
);
const CommandPalette = lazy(() => import("@/shared/components/CommandPalette"));
const FilePreviewModal = lazy(
  () => import("@/features/workspace/components/FilePreviewModal"),
);
const ClipboardPreviewModal = lazy(
  () => import("@/shared/components/ClipboardPreviewModal"),
);
const IntroModal = lazy(() => import("@/shared/components/IntroModal"));

/**
 * Component to orchestrate all lazy-loaded overlay modals and the command palette.
 */
export default function ModalManager() {
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen);
  const isAboutOpen = useUIStore((s) => s.isAboutOpen);
  const isUpdateModalOpen = useUIStore((s) => s.isUpdateModalOpen);
  const isIntroOpen = useUIStore((s) => s.isIntroOpen);
  const viewingHistorySessionId = useUIStore((s) => s.viewingHistorySessionId);
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const previewFilePath = useUIStore((s) => s.previewFilePath);
  const previewClipboardItem = useUIStore((s) => s.previewClipboardItem);
  const setIsSettingsOpen = useUIStore((s) => s.setIsSettingsOpen);
  const setIsAboutOpen = useUIStore((s) => s.setIsAboutOpen);
  const setIsUpdateModalOpen = useUIStore((s) => s.setIsUpdateModalOpen);
  const setIsIntroOpen = useUIStore((s) => s.setIsIntroOpen);
  const setIsCommandPaletteOpen = useUIStore((s) => s.setIsCommandPaletteOpen);
  const setViewingHistorySessionId = useUIStore((s) => s.setViewingHistorySessionId);
  const setPreviewFilePath = useUIStore((s) => s.setPreviewFilePath);
  const setPreviewClipboardItem = useUIStore((s) => s.setPreviewClipboardItem);

  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const newTab = useTabStore((s) => s.newTab);
  const newBrowserTab = useTabStore((s) => s.newBrowserTab);
  const splitTab = useTabStore((s) => s.splitTab);
  const unsplitTab = useTabStore((s) => s.unsplitTab);
  const extractToTab = useTabStore((s) => s.extractToTab);
  const detachTab = useTabStore((s) => s.detachTab);

  const { config, updateConfig, openConfig } = useConfig();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeNode = activeTab
    ? getNode(activeTab.root, activeTab.focusedPath)
    : null;
  const isBrowserFocused = activeNode ? !!activeNode.browserId : false;

  const paletteActions = [
    {
      id: "settings",
      label: "Settings: Open",
      onExecute: () => setIsSettingsOpen(true),
    },
    {
      id: "welcome-guide",
      label: "Help: Show Welcome Guide",
      onExecute: () => setIsIntroOpen(true),
    },
    {
      id: "about",
      label: "App: About Vet",
      onExecute: () => setIsAboutOpen(true),
    },
    {
      id: "config-file",
      label: "Settings: Open config.json5 in Editor",
      onExecute: openConfig,
    },
    {
      id: "toggle-sidebar",
      label: "View: Toggle Sidebar",
      onExecute: () =>
        updateConfig({ sidebarOpen: !config.sidebarOpen }),
    },
    { id: "new-tab", label: "View: New Tab", onExecute: newTab },
    {
      id: "new-browser-tab",
      label: "View: Open Web Browser Tab",
      onExecute: newBrowserTab,
    },
    {
      id: "split-h",
      label: "View: Split Horizontal",
      onExecute: () => splitTab("horizontal"),
    },
    {
      id: "split-v",
      label: "View: Split Vertical",
      onExecute: () => splitTab("vertical"),
    },
    {
      id: "split-unsplit",
      label: "View: Unsplit Tabs",
      onExecute: () => unsplitTab(),
    },
    {
      id: "toggle-fullscreen",
      label: "View: Toggle Fullscreen",
      onExecute: () => window.windowApi?.toggleFullscreen(),
    },
    {
      id: "maximize",
      label: "View: Maximize Window",
      onExecute: () => window.windowApi?.maximize(),
    },
    {
      id: "app-exit",
      label: "App: Exit",
      onExecute: () => window.windowApi?.quit(),
    },
    {
      id: "extract",
      label: "View: Extract Pane to New Tab",
      onExecute: () => {
        if (activeTabId && activeTab)
          extractToTab(activeTabId, activeTab.focusedPath);
      },
    },
    {
      id: "detach-window",
      label: "View: Detach Tab to Window",
      onExecute: () => {
        if (activeTabId) detachTab(activeTabId);
      },
    },
    {
      id: "tabbar-pos-top",
      label: "View: Position Tab Bar at Top",
      onExecute: () => updateConfig({ tabBarPosition: "top" }),
    },
    {
      id: "tabbar-pos-left",
      label: "View: Position Tab Bar on Left",
      onExecute: () => updateConfig({ tabBarPosition: "left" }),
    },
    {
      id: "tabbar-pos-right",
      label: "View: Position Tab Bar on Right",
      onExecute: () => updateConfig({ tabBarPosition: "right" }),
    },
    ...Object.keys(builtinThemes).map((themeName) => ({
      id: `theme-${themeName}`,
      label: `Theme: Set to ${themeName.replace("-", " ")}`,
      onExecute: () => updateConfig({ theme: themeName }),
    })),
    ...Object.keys(config.customThemes || {}).map((themeName) => ({
      id: `theme-custom-${themeName}`,
      label: `Theme: Set to ${themeName.replace("-", " ")} (custom)`,
      onExecute: () => updateConfig({ theme: themeName }),
    })),
    ...(config.profiles || []).map((profile) => ({
      id: `launch-profile-${profile.id}`,
      label: `Profiles: Launch ${profile.name}`,
      onExecute: () => newTab(profile.id),
    })),
    ...(config.sshHosts || [])
      .filter((h): h is SshHost => "host" in h)
      .map((host) => ({
        id: `launch-ssh-${host.id}`,
        label: `SSH: Connect to ${host.name} (${host.host})`,
        onExecute: () => newTab(undefined, host.id),
      })),
  ];

  if (isBrowserFocused) {
    paletteActions.push(
      {
        id: "browser-devtools",
        label: "Browser: Open Developer Tools",
        onExecute: () => {
          window.dispatchEvent(
            new CustomEvent("browser:action", {
              detail: { action: "browser:devtools" },
            }),
          );
        },
      },
      {
        id: "browser-search",
        label: "Browser: Find in Page",
        onExecute: () => {
          window.dispatchEvent(
            new CustomEvent("browser:action", {
              detail: { action: "browser:search" },
            }),
          );
        },
      },
    );
  }

  return (
    <Suspense fallback={null}>
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
      {isIntroOpen && (
        <IntroModal onClose={() => setIsIntroOpen(false)} />
      )}
      {isUpdateModalOpen && (
        <UpdateModal onClose={() => setIsUpdateModalOpen(false)} />
      )}
      {viewingHistorySessionId && (
        <HistoryViewerModal
          sessionId={viewingHistorySessionId}
          onClose={() => setViewingHistorySessionId(null)}
        />
      )}
      {previewFilePath && (
        <FilePreviewModal
          filePath={previewFilePath}
          onClose={() => setPreviewFilePath(null)}
        />
      )}
      {previewClipboardItem && (
        <ClipboardPreviewModal
          item={previewClipboardItem}
          onClose={() => setPreviewClipboardItem(null)}
        />
      )}
      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          actions={paletteActions}
        />
      )}
    </Suspense>
  );
}
