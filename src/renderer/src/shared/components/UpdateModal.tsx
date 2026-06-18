import React, { useEffect, useRef, useState } from "react";
import { ModalOverlay } from "./ModalOverlay";
import { useUpdaterStore } from "@/shared/stores/useUpdaterStore";

interface UpdateModalProps {
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    status,
    updateInfo,
    progress,
    error,
    downloadUpdate,
    quitAndInstall,
  } = useUpdaterStore();

  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
    if (window.windowApi?.getVersion) {
      window.windowApi
        .getVersion()
        .then(setCurrentVersion)
        .catch(console.error);
    }
  }, []);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <ModalOverlay
      onClose={onClose}
      closeOnOverlayClick={status !== "downloading"}
      closeOnEsc={status !== "downloading"}
      containerRef={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Software Update"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        zIndex: 20000,
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes vetUpdateFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .vet-update-container {
          animation: vetUpdateFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          outline: none;
        }
        .vet-update-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: var(--app-fg) !important;
        }
        .vet-update-btn-primary {
          background-color: var(--app-accent, #10b981) !important;
          color: var(--app-bg, #000) !important;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: filter 0.15s ease, opacity 0.15s ease;
        }
        .vet-update-btn-primary:hover {
          filter: brightness(1.1);
        }
        .vet-update-btn-primary:active {
          filter: brightness(0.95);
        }
        .vet-update-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vet-update-btn-secondary {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: var(--app-fg) !important;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .vet-update-btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }
        .vet-update-btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vet-update-notes {
          background-color: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px;
          max-height: 150px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--app-fg-subtle);
          white-space: pre-wrap;
          text-align: left;
          width: 100%;
        }
      `}</style>

      <div
        ref={modalRef}
        tabIndex={0}
        className="vet-update-container"
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
          padding: "32px 24px 24px 24px",
          position: "relative",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: "var(--app-fg)",
        }}
      >
        {/* Top Right Close Button */}
        {status !== "downloading" && (
          <button
            className="vet-update-close-btn"
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
        )}

        {/* Dynamic Glowing Icon */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background:
              "linear-gradient(135deg, var(--app-accent, #10b981) 0%, color-mix(in srgb, var(--app-accent, #10b981) 60%, #000) 100%)",
            boxShadow:
              "0 8px 24px -4px rgba(16, 185, 129, 0.2), 0 0 16px rgba(16, 185, 129, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--app-bg, #000)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="8 17 12 21 16 17"></polyline>
            <line x1="12" y1="12" x2="12" y2="21"></line>
            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
          </svg>
        </div>

        {/* App Title */}
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.3px",
          }}
        >
          Software Update
        </h2>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 12,
            fontSize: 13,
            color: "var(--app-fg-subtle)",
          }}
        >
          <div>
            Current:{" "}
            <strong style={{ color: "var(--app-fg)" }}>{currentVersion}</strong>
          </div>
          <div style={{ color: "rgba(255,255,255,0.15)" }}>|</div>
          <div>
            New:{" "}
            <strong style={{ color: "var(--app-accent, #10b981)" }}>
              {updateInfo?.version || "Unknown"}
            </strong>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            margin: "18px 0",
          }}
        />

        {/* Update Notes / Release Info */}
        {updateInfo?.releaseNotes && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--app-fg-muted)",
                alignSelf: "flex-start",
              }}
            >
              Release Notes
            </span>
            <div className="vet-update-notes">{updateInfo.releaseNotes}</div>
          </div>
        )}

        {/* Progress or status information */}
        {status === "downloading" && progress && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--app-fg-muted)",
              }}
            >
              <span>Downloading update...</span>
              <span>{Math.round(progress.percent)}%</span>
            </div>

            {/* Progress bar container */}
            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress.percent}%`,
                  height: "100%",
                  backgroundColor: "var(--app-accent, #10b981)",
                  borderRadius: 3,
                  transition: "width 0.1s linear",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--app-fg-muted)",
                marginTop: 2,
              }}
            >
              <span>Speed: {formatBytes(progress.bytesPerSecond)}/s</span>
              <span>
                {formatBytes(progress.transferred)} /{" "}
                {formatBytes(progress.total)}
              </span>
            </div>
          </div>
        )}

        {status === "downloaded" && (
          <div
            style={{
              color: "var(--app-accent, #10b981)",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 20,
            }}
          >
            ✓ Update downloaded and ready to install.
          </div>
        )}

        {error && (
          <div
            style={{
              color: "#ef4444",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          {status !== "downloading" && (
            <button className="vet-update-btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}

          {status === "available" && (
            <button className="vet-update-btn-primary" onClick={downloadUpdate}>
              Download & Install
            </button>
          )}

          {status === "downloaded" && (
            <button className="vet-update-btn-primary" onClick={quitAndInstall}>
              Restart & Apply
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
};

export default UpdateModal;
