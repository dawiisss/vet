import { useEffect, RefObject } from "react";

/**
 * Reusable hook to trap keyboard focus within a container (e.g. for modals or dialogs).
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean = true,
) {
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;

      const focusableElements = ref.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey) {
          if (
            document.activeElement === firstElement ||
            document.activeElement === ref.current
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [ref, active]);
}
