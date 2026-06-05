## 2026-06-05 - Adding ARIA labels to custom icon buttons
**Learning:** Custom UI elements like icon-only buttons (e.g. built with `div` or `span` containing SVG) are invisible to screen readers unless proper ARIA attributes are provided. Simply adding `title` or inline text is not enough.
**Action:** Always add `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` (for Space/Enter) to custom interactive elements that act as buttons to ensure they are accessible via keyboard and screen readers.
