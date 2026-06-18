import React, { useState, useRef, useEffect } from "react";
import { ModalOverlay } from "./ModalOverlay";
import { useConfig } from "@/features/settings/useConfigStore";
import { builtinThemes } from "@/themes";

interface IntroModalProps {
  onClose: () => void;
}

interface Slide {
  title: string;
  subtitle: string;
  description: string;
  renderVisual: () => React.ReactNode;
}

export const IntroModal: React.FC<IntroModalProps> = ({ onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { config, updateConfig } = useConfig();

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  const handleFinish = async () => {
    await updateConfig({ showIntroOnStartup: false });
    onClose();
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const selectTheme = (themeName: string) => {
    updateConfig({ theme: themeName });
  };

  const slides: Slide[] = [
    {
      title: "Welcome to Vet",
      subtitle: "Very Easy Terminal",
      description: "Vet is a modern, high-performance terminal emulator designed to replace complex config files with a clean, premium, and interactive developer environment.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.welcomeGlow}>
            <span style={styles.welcomeLogo}>&gt;_</span>
          </div>
          <div className="pulse-text" style={{ marginTop: 24, fontFamily: "monospace", fontSize: 13, color: "var(--app-accent)" }}>
            initializing session...
          </div>
        </div>
      ),
    },
    {
      title: "Multi-Pane Split & Persistence",
      subtitle: "Maximize your screen estate",
      description: "Split your tab using the Command Palette, or by drag-and-dropping a tab header onto the drag zones. Navigate between split panes using Alt + Arrows. Vet automatically restores all splits, tabs, and sessions on launch!",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.splitGridMock}>
            <div style={{ ...styles.splitPaneMock, flex: 1, borderRight: "2px solid var(--app-accent)", background: "rgba(255,255,255,0.03)" }}>
              <div style={styles.mockTerminalHeader}>
                <span style={{ ...styles.mockTerminalDot, background: "var(--app-red)" }}></span>
                <span style={{ ...styles.mockTerminalDot, background: "var(--app-yellow)" }}></span>
                <span style={{ ...styles.mockTerminalDot, background: "var(--app-green)" }}></span>
                <span style={{ marginLeft: 8, fontSize: 10, color: "var(--app-accent)" }}>bash (active)</span>
              </div>
              <div style={styles.mockTerminalContent}>
                <div style={styles.mockTerminalLine}><span style={{ color: "var(--app-green)" }}>user@vet</span>:<span style={{ color: "var(--app-blue)" }}>~</span>$ npm run dev</div>
                <div style={styles.mockTerminalLine}>Ready on port 3000...</div>
                <div style={styles.mockTerminalPrompt}>$ <span className="blink-cursor">|</span></div>
              </div>
            </div>
            <div style={{ ...styles.splitPaneMock, flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, borderBottom: "1px solid var(--app-border)" }}>
                <div style={styles.mockTerminalHeader}>
                  <span style={{ fontSize: 9, color: "var(--app-fg-muted)" }}>node</span>
                </div>
                <div style={{ ...styles.mockTerminalContent, padding: 8 }}>
                  <div style={{ ...styles.mockTerminalLine, fontSize: 9 }}>&gt; 1 + 1</div>
                  <div style={{ ...styles.mockTerminalLine, fontSize: 9, color: "var(--app-yellow)" }}>2</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.mockTerminalHeader}>
                  <span style={{ fontSize: 9, color: "var(--app-fg-muted)" }}>top</span>
                </div>
                <div style={{ ...styles.mockTerminalContent, padding: 8 }}>
                  <div style={{ ...styles.mockTerminalLine, fontSize: 9, color: "var(--app-green)" }}>CPU: 1.2% | MEM: 42%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Built-in Web Browser",
      subtitle: "Reference docs instantly",
      description: "Open a browser tab using the Command Palette (Ctrl+Shift+P) or from the sidebar. Browser tabs integrate seamlessly into the main layout—meaning you can split, resize, and mix them with regular terminal panes.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.browserMock}>
            <div style={styles.browserNavBar}>
              <div style={styles.browserNavControls}>
                <span style={styles.browserNavArrow}>&larr;</span>
                <span style={styles.browserNavArrow}>&rarr;</span>
                <span style={{ ...styles.browserNavArrow, fontSize: 12 }}>&#x21bb;</span>
              </div>
              <div style={styles.browserUrlBar}>
                <span style={{ color: "var(--app-green)", marginRight: 4 }}>&reg;</span>
                https://react.dev
              </div>
              <div style={styles.browserShield}>🛡️</div>
            </div>
            <div style={styles.browserBody}>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>React Documentation</div>
              <div style={{ height: 6, width: "80%", background: "var(--app-fg-muted)", borderRadius: 3, marginBottom: 4 }}></div>
              <div style={{ height: 6, width: "60%", background: "var(--app-fg-muted)", borderRadius: 3, marginBottom: 12 }}></div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ height: 20, width: 60, background: "var(--app-accent)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "var(--app-bg)", fontWeight: "bold" }}>Get Started</div>
                <div style={{ height: 20, width: 60, border: "1px solid var(--app-border)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>Reference</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "SSH & Profile Manager",
      subtitle: "Instant remote and local access",
      description: "Configure local shell configurations or remote SSH servers. Double-click any configuration from the sidebar to launch a secure session in a new tab.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.profilesMock}>
            <div style={styles.profileItemMockActive}>
              <span style={styles.profileIndicatorGreen}></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: "bold" }}>Production Server (Web)</div>
                <div style={{ fontSize: 9, color: "var(--app-fg-muted)" }}>ubuntu@192.168.1.100:22</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--app-accent)" }}>Connected</span>
            </div>
            <div style={styles.profileItemMock}>
              <span style={styles.profileIndicatorGray}></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: "bold" }}>Staging Server</div>
                <div style={{ fontSize: 9, color: "var(--app-fg-muted)" }}>deploy@192.168.1.101:22</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--app-fg-muted)" }}>SSH</span>
            </div>
            <div style={styles.profileItemMock}>
              <span style={styles.profileIndicatorGray}></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: "bold" }}>Power Shell Core</div>
                <div style={{ fontSize: 9, color: "var(--app-fg-muted)" }}>pwsh</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--app-fg-muted)" }}>Local</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Flexible Sidebar Panels",
      subtitle: "Built-in developer toolbox",
      description: "Toggle the sidebar using Ctrl+Shift+B, position it on the left or right, and resize it to your liking. The sidebar houses system & port monitors, a script runner, command snippets, connections list, and clipboard history.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.sidebarMockContainer}>
            <div style={styles.sidebarMockPanel}>
              <div style={{ fontSize: 10, fontWeight: "bold", borderBottom: "1px solid var(--app-border)", paddingBottom: 4, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>SYSTEM MONITOR</span>
                <span style={{ color: "var(--app-green)" }}>ON</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 2 }}>
                  <span>CPU Usage</span>
                  <span>14%</span>
                </div>
                <div style={{ height: 4, background: "var(--app-border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "14%", background: "var(--app-accent)" }}></div>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 2 }}>
                  <span>Memory</span>
                  <span>4.2 GB / 16.0 GB</span>
                </div>
                <div style={{ height: 4, background: "var(--app-border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "26%", background: "var(--app-accent)" }}></div>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: "bold", borderBottom: "1px solid var(--app-border)", paddingBottom: 4, marginTop: 12, marginBottom: 6 }}>
                <span>SNIPPET LIBRARY</span>
              </div>
              <div style={styles.snippetItemMock}>
                <span style={{ fontSize: 10 }}>🚀 Deploy App</span>
                <span style={{ fontSize: 8, color: "var(--app-accent)" }}>Run</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Global Command Palette",
      subtitle: "Your command center",
      description: "Press Ctrl+Shift+P (or Cmd+Shift+P) at any time to query settings, connect to saved hosts, switch color themes instantly, split views, and manage workspaces without picking up the mouse.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.commandPaletteMock}>
            <div style={styles.paletteSearch}>
              <span style={{ marginRight: 6 }}>🔍</span>
              <input type="text" readOnly value="Theme: " style={styles.paletteInput} />
            </div>
            <div style={styles.paletteListItemActive}>
              <span>Theme: Set to Catppuccin Mocha</span>
              <span style={styles.paletteBadge}>Accent</span>
            </div>
            <div style={styles.paletteListItem}>
              <span>Theme: Set to Dracula</span>
              <span></span>
            </div>
            <div style={styles.paletteListItem}>
              <span>Theme: Set to Nord</span>
              <span></span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Persistent Command History",
      subtitle: "Deep history indexing",
      description: "Never lose a command again. Every command you run in Vet is indexed in a local, fast SQLite database. Use the History panel to query past inputs and search by keywords.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.historyMock}>
            <div style={styles.historySearch}>
              <span>🔍 Search terminal history...</span>
            </div>
            <div style={styles.historyItem}>
              <span style={styles.historyTime}>10:14 AM</span>
              <code style={styles.historyCode}>git commit -m &quot;feat: add onboarding intro&quot;</code>
            </div>
            <div style={styles.historyItem}>
              <span style={styles.historyTime}>10:11 AM</span>
              <code style={styles.historyCode}>npm run lint -- --fix</code>
            </div>
            <div style={styles.historyItem}>
              <span style={styles.historyTime}>09:42 AM</span>
              <code style={styles.historyCode}>docker-compose up -d --build</code>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Keyboard Shortcuts",
      subtitle: "Work at the speed of thought",
      description: "Vet is fully optimized for keyboard productivity. Learn these core hotkeys to navigate tabs, panes, and tools effortlessly.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={styles.shortcutsTable}>
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutKey}>Ctrl+Shift+P</span>
              <span style={styles.shortcutDesc}>Toggle Command Palette</span>
            </div>
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutKey}>Ctrl+Shift+D</span>
              <span style={styles.shortcutDesc}>Split Pane Vertically</span>
            </div>
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutKey}>Ctrl+Shift+\</span>
              <span style={styles.shortcutDesc}>Split Pane Horizontally</span>
            </div>
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutKey}>Ctrl+Shift+T</span>
              <span style={styles.shortcutDesc}>Create New Tab</span>
            </div>
            <div style={styles.shortcutRow}>
              <span style={styles.shortcutKey}>Ctrl+Shift+B</span>
              <span style={styles.shortcutDesc}>Toggle Sidebar</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Ready to Roll!",
      subtitle: "Customize your environment",
      description: "You're all set! Click a theme button below to select your style, then hit 'Get Started' to jump right into the terminal.",
      renderVisual: () => (
        <div style={styles.visualContainer}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "var(--app-fg-muted)", textAlign: "center", marginBottom: 2 }}>
              SELECT A THEME TO START
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.keys(builtinThemes).slice(0, 4).map((themeName) => {
                const isActive = config.theme === themeName;
                const displayName = themeName.replace("-", " ");
                return (
                  <button
                    key={themeName}
                    onClick={() => selectTheme(themeName)}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 8,
                      background: isActive ? "var(--app-accent)" : "rgba(255, 255, 255, 0.04)",
                      color: isActive ? "var(--app-bg)" : "var(--app-fg)",
                      border: isActive ? "1px solid var(--app-accent)" : "1px solid var(--app-border)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.15s ease",
                      boxShadow: isActive ? "0 4px 12px rgba(0, 0, 0, 0.2)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.borderColor = "var(--app-accent)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                        e.currentTarget.style.borderColor = "var(--app-border)";
                      }
                    }}
                  >
                    {displayName}
                  </button>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "var(--app-fg-muted)" }}>
              Current theme: <strong style={{ color: "var(--app-accent)" }}>{config.theme}</strong>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const slide = slides[currentSlide];

  return (
    <ModalOverlay
      onClose={onClose}
      containerRef={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Vet Onboarding"
      closeOnOverlayClick={false}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        zIndex: 20000,
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes introFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .intro-modal-container {
          animation: introFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          outline: none;
        }
        .intro-skip-btn:hover {
          color: var(--app-fg) !important;
          background-color: rgba(255, 255, 255, 0.05);
        }
        .intro-nav-btn {
          border: 1px solid var(--app-border);
          background: rgba(255, 255, 255, 0.02);
          color: var(--app-fg);
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .intro-nav-btn:hover {
          border-color: var(--app-accent);
          background: rgba(255, 255, 255, 0.05);
        }
        .intro-nav-btn-primary {
          background: var(--app-accent) !important;
          color: var(--app-bg) !important;
          border: 1px solid var(--app-accent);
        }
        .intro-nav-btn-primary:hover {
          filter: brightness(1.1);
        }
        @keyframes pulseGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(var(--accent-rgb, 120, 120, 255), 0.4);
          }
          70% {
            box-shadow: 0 0 0 16px rgba(var(--accent-rgb, 120, 120, 255), 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(var(--accent-rgb, 120, 120, 255), 0);
          }
        }
        .pulse-glow-effect {
          animation: pulseGlow 2s infinite;
        }
        @keyframes blinkCursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .blink-cursor {
          animation: blinkCursor 1s step-end infinite;
          color: var(--app-accent);
          font-weight: bold;
        }
        @keyframes pulseText {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .pulse-text {
          animation: pulseText 1.5s ease-in-out infinite;
        }
      `}</style>
      <div
        ref={modalRef}
        tabIndex={0}
        className="intro-modal-container"
        style={{
          width: 650,
          height: 520,
          background: "linear-gradient(135deg, color-mix(in srgb, var(--app-bg) 92%, #fff) 0%, var(--app-bg) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: "var(--app-fg)",
          overflow: "hidden",
        }}
      >
        {/* Skip button (on all screens except last) */}
        {currentSlide < slides.length - 1 && (
          <button
            className="intro-skip-btn"
            onClick={handleFinish}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "transparent",
              border: "none",
              color: "var(--app-fg-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 6,
              transition: "all 0.15s ease",
              zIndex: 10,
            }}
          >
            Skip
          </button>
        )}

        {/* Carousel Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 40px 20px 40px" }}>
          
          {/* Visual Area */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, marginBottom: 20 }}>
            {slide.renderVisual()}
          </div>

          {/* Text Area */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--app-accent)" }}>
              {slide.subtitle}
            </span>
            <h2 style={{ margin: "4px 0 10px 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>
              {slide.title}
            </h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: "1.6", color: "var(--app-fg-subtle)", padding: "0 20px", height: 64, overflow: "hidden" }}>
              {slide.description}
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div style={{
          height: 64,
          borderTop: "1px solid var(--app-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "rgba(0,0,0,0.08)",
          flexShrink: 0,
        }}>
          {/* Back button */}
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="intro-nav-btn"
            style={{ opacity: currentSlide === 0 ? 0.3 : 1, cursor: currentSlide === 0 ? "default" : "pointer" }}
          >
            &larr; Back
          </button>

          {/* Indicators */}
          <div style={{ display: "flex", gap: 6 }}>
            {slides.map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentSlide(index)}
                style={{
                  width: index === currentSlide ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: index === currentSlide ? "var(--app-accent)" : "var(--app-border)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>

          {/* Next / Finish button */}
          <button
            onClick={nextSlide}
            className={`intro-nav-btn ${currentSlide === slides.length - 1 ? "intro-nav-btn-primary" : ""}`}
          >
            {currentSlide === slides.length - 1 ? "Get Started" : "Next \u2192"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

const styles = {
  visualContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeGlow: {
    width: 80,
    height: 80,
    borderRadius: 24,
    background: "linear-gradient(135deg, var(--app-accent) 0%, color-mix(in srgb, var(--app-accent) 60%, #000) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.4)",
    animation: "pulseGlow 2s infinite",
  },
  welcomeLogo: {
    fontSize: 34,
    fontFamily: "monospace",
    fontWeight: "bold" as const,
    color: "var(--app-bg)",
  },
  splitGridMock: {
    width: "100%",
    maxWidth: 420,
    height: 160,
    border: "1px solid var(--app-border)",
    borderRadius: 8,
    display: "flex",
    overflow: "hidden",
    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
  },
  splitPaneMock: {
    height: "100%",
  },
  mockTerminalHeader: {
    height: 20,
    background: "rgba(0,0,0,0.15)",
    borderBottom: "1px solid var(--app-border)",
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
  },
  mockTerminalDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    marginRight: 4,
  },
  mockTerminalContent: {
    padding: 12,
    fontFamily: "monospace",
    fontSize: 10,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  mockTerminalLine: {
    color: "var(--app-fg)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
  },
  mockTerminalPrompt: {
    color: "var(--app-accent)",
  },
  browserMock: {
    width: "100%",
    maxWidth: 420,
    height: 160,
    border: "1px solid var(--app-border)",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
    background: "var(--app-bg)",
  },
  browserNavBar: {
    height: 28,
    background: "rgba(0,0,0,0.15)",
    borderBottom: "1px solid var(--app-border)",
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    gap: 8,
  },
  browserNavControls: {
    display: "flex",
    gap: 6,
  },
  browserNavArrow: {
    fontSize: 10,
    color: "var(--app-fg-muted)",
    cursor: "default",
  },
  browserUrlBar: {
    flex: 1,
    height: 18,
    background: "rgba(0,0,0,0.2)",
    borderRadius: 4,
    border: "1px solid var(--app-border)",
    fontSize: 9,
    color: "var(--app-fg-subtle)",
    display: "flex",
    alignItems: "center",
    padding: "0 6px",
  },
  browserShield: {
    fontSize: 10,
  },
  browserBody: {
    flex: 1,
    padding: 12,
    display: "flex",
    flexDirection: "column" as const,
    fontFamily: "system-ui, sans-serif",
  },
  profilesMock: {
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  profileItemMockActive: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--app-accent)",
    gap: 10,
  },
  profileItemMock: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.01)",
    border: "1px solid var(--app-border)",
    gap: 10,
  },
  profileIndicatorGreen: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--app-green)",
    boxShadow: "0 0 6px var(--app-green)",
  },
  profileIndicatorGray: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--app-border)",
  },
  sidebarMockContainer: {
    width: "100%",
    maxWidth: 360,
    height: 160,
    border: "1px solid var(--app-border)",
    borderRadius: 8,
    display: "flex",
    justifyContent: "flex-end",
    background: "rgba(0,0,0,0.1)",
    position: "relative" as const,
    overflow: "hidden",
  },
  sidebarMockPanel: {
    width: 180,
    height: "100%",
    borderLeft: "1px solid var(--app-border)",
    background: "var(--app-bg)",
    padding: 10,
    display: "flex",
    flexDirection: "column" as const,
  },
  snippetItemMock: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 6px",
    borderRadius: 4,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--app-border)",
  },
  commandPaletteMock: {
    width: "100%",
    maxWidth: 380,
    border: "1px solid var(--app-border)",
    borderRadius: 8,
    background: "var(--app-bg)",
    boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  },
  paletteSearch: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid var(--app-border)",
  },
  paletteInput: {
    background: "transparent",
    border: "none",
    color: "var(--app-fg)",
    fontSize: 12,
    outline: "none",
    width: "100%",
  },
  paletteListItemActive: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.04)",
    borderLeft: "2px solid var(--app-accent)",
    fontSize: 11,
  },
  paletteListItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    fontSize: 11,
    color: "var(--app-fg-subtle)",
  },
  paletteBadge: {
    fontSize: 8,
    background: "var(--app-accent)",
    color: "var(--app-bg)",
    padding: "2px 4px",
    borderRadius: 3,
    fontWeight: "bold" as const,
  },
  historyMock: {
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  historySearch: {
    border: "1px solid var(--app-border)",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 10,
    color: "var(--app-fg-muted)",
    background: "rgba(0,0,0,0.1)",
  },
  historyItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 10,
  },
  historyTime: {
    color: "var(--app-fg-muted)",
    width: 60,
    fontFamily: "monospace",
  },
  historyCode: {
    color: "var(--app-fg-subtle)",
    whiteSpace: "nowrap" as const,
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  shortcutsTable: {
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  shortcutRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 6,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid var(--app-border)",
  },
  shortcutKey: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "bold" as const,
    color: "var(--app-accent)",
    background: "rgba(0,0,0,0.15)",
    padding: "2px 6px",
    borderRadius: 4,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  shortcutDesc: {
    fontSize: 11.5,
    color: "var(--app-fg-subtle)",
  },
};
export default IntroModal;
