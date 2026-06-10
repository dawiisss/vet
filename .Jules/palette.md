## 2026-06-05 - Adding ARIA labels to custom icon buttons
**Learning:** Custom UI elements like icon-only buttons (e.g. built with `div` or `span` containing SVG) are invisible to screen readers unless proper ARIA attributes are provided. Simply adding `title` or inline text is not enough.
**Action:** Always add `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` (for Space/Enter) to custom interactive elements that act as buttons to ensure they are accessible via keyboard and screen readers.
## 2024-06-06 - Settings Modal Accessibility Labels\nLearning: Many form inputs in the settings modal were lacking `id` and `htmlFor` associations.\nAction: Ensure all form inputs have associated labels with matching `id` and `htmlFor` attributes to improve screen reader accessibility and label clickability.
## 2024-05-18 - [Persona Constraint Enforcement]
Learning: When assigned a task by Maestro that requires backend (main process) modifications (such as configuring OS-level window vibrancy), it is a strict violation of the Palette persona's boundary (UX/a11y only).
Action: Immediately reject such tasks by modifying the orchestration plan with a rejection notice and falling back to a <50 line UI/a11y enhancement in an appropriate file.

## 2026-06-06 - Window Controls Accessibility
**Learning:** Window controls like minimize, maximize, and close are fundamental app controls that must be accessible. Using only SVG icons without ARIA labels makes them completely invisible to screen readers, and lacking tooltips (`title`) degrades the desktop UX.
**Action:** Always provide `aria-label` and `title` attributes on custom window controls in desktop applications.
## 2026-06-07 - [No Tailwind CSS] Learning: [The project does NOT use Tailwind CSS. Any focus styles must be applied via CSS-in-JS, inline styles, or global CSS variables, but crucially, inline `outline: 'none'` will override global CSS `:focus-visible` styles, breaking keyboard accessibility.] Action: [Ensure interactive elements like inputs and textareas do not explicitly set `outline: 'none'` unless a custom focus ring is explicitly handled in CSS.]
## 2026-06-08 - [Empty States] Learning: [Adding visual empty states to panels significantly improves UX over plain text. Also, ensuring that ARIA roles (tablist, tab, tabpanel) are correctly applied to custom sidebar implementations is crucial for screen-reader accessibility.] Action: [Always check custom tab implementations for proper ARIA roles and replace text-only empty states with visually helpful guidance.]
## 2026-06-09 - Sidebar Empty States Accessibility
**Learning:** Text-only empty states degrade the user experience and can be visually boring or easily missed. Adding SVG icons alongside empty state text improves visual hierarchy. Additionally, custom action buttons (like 'Refresh' or 'Kill' in lists) without `aria-label`s are inaccessible to screen readers.
**Action:** When creating or updating UI panels, ensure empty states are visually distinct (e.g., using a muted SVG icon and subtext) and always add descriptive `aria-label` attributes to action buttons lacking visible text labels.
