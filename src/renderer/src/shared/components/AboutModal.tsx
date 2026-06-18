import React, { useEffect, useRef, useState } from "react";
import { ModalOverlay } from "./ModalOverlay";

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState<string>("1.0.2");

  useEffect(() => {
    // Focus modal for accessibility
    if (modalRef.current) {
      modalRef.current.focus();
    }

    if (window.windowApi?.getVersion) {
      window.windowApi.getVersion().then(setVersion).catch(console.error);
    }
  }, []);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    window.windowApi?.openExternal?.(url);
  };

  return (
    <ModalOverlay
      onClose={onClose}
      containerRef={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="About Vet"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 20000,
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes vetAboutFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .vet-about-container {
          animation: vetAboutFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          outline: none;
        }
        .vet-about-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: var(--app-fg) !important;
        }
        .vet-about-link {
          color: var(--app-accent);
          text-decoration: none;
          transition: color 0.15s ease;
          font-weight: 500;
          cursor: pointer;
        }
        .vet-about-link:hover {
          color: var(--app-fg);
          text-decoration: underline;
        }
        .vet-about-action-btn {
          background-color: var(--app-accent) !important;
          color: var(--app-bg) !important;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: filter 0.15s ease;
        }
        .vet-about-action-btn:hover {
          filter: brightness(1.1);
        }
        .vet-about-action-btn:active {
          filter: brightness(0.95);
        }
      `}</style>
      <div
        ref={modalRef}
        tabIndex={0}
        className="vet-about-container"
        style={{
          width: 440,
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--app-bg) 85%, #fff) 0%, var(--app-bg) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          boxShadow:
            "0 24px 48px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "36px 28px 24px 28px",
          position: "relative",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: "var(--app-fg)",
        }}
      >
        {/* Top Right Close Button */}
        <button
          className="vet-about-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            color: "var(--app-fg-muted)",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.15s, color 0.15s",
            lineHeight: 1,
          }}
        >
          &times;
        </button>

        {/* Dynamic Glowing Icon */}
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            background:
              "linear-gradient(135deg, var(--app-accent) 0%, color-mix(in srgb, var(--app-accent) 60%, #000) 100%)",
            boxShadow:
              "0 8px 24px -4px rgba(0, 0, 0, 0.3), 0 0 16px rgba(120, 120, 255, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontFamily: "monospace",
              fontWeight: "bold",
              color: "var(--app-bg)",
            }}
          >
            &gt;_
          </span>
        </div>

        {/* App Title and Lore */}
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.5px",
          }}
        >
          Vet
        </h2>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "var(--app-accent)",
            marginTop: 4,
            marginBottom: 16,
          }}
        >
          Very Easy Terminal
        </div>

        {/* Narrative Description */}
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: "1.6",
            textAlign: "center",
            color: "var(--app-fg-subtle)",
          }}
        >
          Vet stands for <strong>Very Easy Terminal</strong>. It is designed to
          replace cluttered, complex config files with a beautifully premium
          interface. Vet integrates multi-pane splitting, snippet storage,
          script runner tools, system/port monitors, and a local history
          database directly into one cohesive layout.
        </p>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            margin: "20px 0",
          }}
        />

        {/* Specs Table */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 12.5,
            color: "var(--app-fg-subtle)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--app-fg-muted)" }}>Version</span>
            <span style={{ fontWeight: 600, color: "var(--app-fg)" }}>
              {version}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--app-fg-muted)" }}>Architecture</span>
            <span style={{ color: "var(--app-fg)" }}>
              Electron + React + xterm.js
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--app-fg-muted)" }}>Database</span>
            <span style={{ color: "var(--app-fg)" }}>
              SQLite (Persistent History)
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--app-fg-muted)" }}>
              Developer Support
            </span>
            <a
              onClick={(e) =>
                handleLinkClick(e, "https://github.com/dawiisss/vet")
              }
              className="vet-about-link"
            >
              GitHub Repository
            </a>
          </div>
          {process.env.NODE_ENV === "development" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--app-fg-muted)" }}>
                Developer Mode
              </span>
              <button
                onClick={() => {
                  window.updaterApi.simulateUpdate();
                  onClose();
                }}
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid var(--app-accent, #10b981)",
                  padding: "4px 10px",
                  borderRadius: 4,
                  color: "var(--app-accent, #10b981)",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(16, 185, 129, 0.22)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(16, 185, 129, 0.12)")
                }
              >
                Simulate Update
              </button>
            </div>
          )}
        </div>

        {/* Action button */}
        <button className="vet-about-action-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </ModalOverlay>
  );
};

export default AboutModal;
