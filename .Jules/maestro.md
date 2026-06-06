## 2026-06-05 - Initial observation
Learning: The current priority based on ImplementationPlan.md is to start Phase 4 — Core Advanced & Terminal Features. Specifically, WebGL renderer support needs proper tracking, and since `TerminalView.tsx` already has partial implementations for WebGL (e.g. `WebglAddon` and error handling), we need to organize tickets to finish and test it.

Action: Create tasks that break down the rest of Phase 4 and start tracking what needs to be delegated, taking care not to overlap files.

## 2026-06-06 - OS-Level UI Bounds
Learning: Agents like Palette are restricted to frontend CSS/DOM changes. Tasks affecting OS-level visuals (e.g., Vibrancy, Acrylic, opacity) inherently require modifying the Electron Main Process via IPC, which violates Palette's persona.
Action: Reassign OS-level visual effects or UI tasks requiring main process modifications to Forge or Blueprint instead.
