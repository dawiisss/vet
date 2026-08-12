import { useEffect, useState } from "react";
import Panel from "@/shared/components/Panel";
import { useTabStore } from "@/features/terminal/useTabStore";
import { useUIStore } from "@/shared/stores/useUIStore";

export default function ProfilesPanel({ isActive }: { isActive: boolean }) {
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [newProfileName, setNewProfileName] = useState("");
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const loadProfileState = useTabStore((s) => s.loadProfileState);
  const addToast = useUIStore((s) => s.addToast);

  const loadProfiles = async () => {
    try {
      const data = await window.terminalApi.getProfiles();
      setProfiles(data || {});
    } catch (err: any) {
      addToast("Failed to load profiles", "error");
    }
  };

  useEffect(() => {
    if (isActive) {
      loadProfiles();
    }
  }, [isActive]);

  const handleSaveCurrentWorkspace = async () => {
    if (!newProfileName.trim()) return;
    const sessionData = {
      tabs,
      activeTabId,
    };
    try {
      await window.terminalApi.saveProfile(newProfileName.trim(), sessionData);
      setNewProfileName("");
      loadProfiles();
      addToast(`Workspace saved as "${newProfileName}"`, "info");
    } catch (err: any) {
      addToast(`Failed to save profile: ${err.message}`, "error");
    }
  };

  const handleLoadProfile = async (name: string) => {
    const profile = profiles[name];
    if (!profile) return;
    try {
      await loadProfileState(profile);
      addToast(`Workspace "${name}" loaded`, "info");
    } catch (err: any) {
      addToast(`Failed to load profile: ${err.message}`, "error");
    }
  };

  const handleDeleteProfile = async (name: string) => {
    try {
      await window.terminalApi.deleteProfile(name);
      loadProfiles();
      addToast(`Profile "${name}" deleted`, "info");
    } catch (err: any) {
      addToast(`Failed to delete profile: ${err.message}`, "error");
    }
  };

  return (
    <Panel title="Workspace Profiles" hasScrollableBody={false} tabIndex={0}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveCurrentWorkspace();
            }}
            placeholder="Profile Name..."
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "6px 10px",
              borderRadius: 4,
              color: "var(--app-fg)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleSaveCurrentWorkspace}
            disabled={!newProfileName.trim() || tabs.length === 0}
            style={{
              background: "color-mix(in srgb, var(--app-blue) 15%, transparent)",
              border: "1px solid var(--app-blue)",
              padding: "6px",
              borderRadius: 4,
              color: "var(--app-blue)",
              cursor: newProfileName.trim() && tabs.length > 0 ? "pointer" : "default",
              fontSize: 12,
              fontWeight: 600,
              opacity: newProfileName.trim() && tabs.length > 0 ? 1 : 0.5,
            }}
          >
            Save Current Workspace
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--app-fg-subtle)", marginTop: 8 }}>
          SAVED PROFILES
        </div>

        <div
          className="app-scrollbar"
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}
        >
          {Object.keys(profiles).length === 0 ? (
            <div style={{ color: "var(--app-fg-muted)", fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>
              No profiles saved yet.
            </div>
          ) : (
            Object.keys(profiles).map((name) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--app-fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={name}
                >
                  {name}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => handleLoadProfile(name)}
                    title="Load Profile"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--app-green)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(name)}
                    title="Delete Profile"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--app-red)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
