## 2026-06-05 - Phase 4 Completion
Learning: Phase 4 — Core Advanced & Terminal Features is now fully completed and should no longer be actively worked on or prioritized.
Action: Move focus entirely to Phase 5 and beyond. Do not assign or scope any further tasks related to Phase 4.

## 2026-06-06 - OS-Level UI Bounds
Learning: Agents like Palette are restricted to frontend CSS/DOM changes. Tasks affecting OS-level visuals (e.g., Vibrancy, Acrylic, opacity) inherently require modifying the Electron Main Process via IPC, which violates Palette's persona.
Action: Reassign OS-level visual effects or UI tasks requiring main process modifications to Forge or Blueprint instead.

## 2026-06-06 - Proactive Scope Analysis
Learning: When verifying a feature requirement like "Terminal Clipboard & Snippet Library", I noticed the UI components existed but only implemented half the specification (Snippets, but no Clipboard History). Proactively scoping the missing half ensures feature parity with the roadmap before the team assumes it is finished.
Action: Regularly cross-reference existing UI panels against their definitions in `ImplementationPlan.md` to identify missing sub-features and draft orchestration tickets for them.
