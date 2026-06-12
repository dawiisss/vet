import { useEffect } from 'react'

/**
 * Reusable hook to handle Escape key press for dismissing modals, popovers, or menus.
 */
export function useEscapeKey(onClose: () => void, active: boolean = true) {
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, active])
}
