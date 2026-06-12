import { useTabStore } from './useTabStore'
import type { DropZone } from './useTabStore'

/**
 * React hook to handle tab dragging operations.
 * Manages dragging states, drop zones, tab reordering, and window detaching.
 */
export function useTabDrag() {
  const dragState = useTabStore(s => s.dragState)
  const setDragState = useTabStore(s => s.setDragState)
  const setTabs = useTabStore(s => s.setTabs)
  const activeTabId = useTabStore(s => s.activeTabId)
  const tabs = useTabStore(s => s.tabs)
  const detachTab = useTabStore(s => s.detachTab)
  const mergeTabAsSplit = useTabStore(s => s.mergeTabAsSplit)

  const handleDragStart = (tabId: string) => {
    setDragState({ tabId, zone: 'none' })
  }

  const handleDragMove = (x: number, y: number, terminalArea: HTMLDivElement | null) => {
    if (!terminalArea) {
      setDragState(prev => prev ? { ...prev, zone: 'none' } : null)
      return
    }

    const r = terminalArea.getBoundingClientRect()
    const relX = x - r.left
    const relY = y - r.top
    const rightPct = relX / r.width
    const bottomPct = relY / r.height

    let zone: DropZone = 'none'
    if (relX >= 0 && relX <= r.width && relY >= 0 && relY <= r.height) {
      if (rightPct > 0.8) zone = 'right'
      else if (bottomPct > 0.8) zone = 'bottom'
    } else {
      zone = 'outside'
    }

    setDragState(prev => prev ? { ...prev, zone } : null)
  }

  const handleDragEnd = (tabId: string, x: number, y: number, terminalArea: HTMLDivElement | null) => {
    setDragState(null)

    // Check if dropped onto another tab for reordering
    const elements = document.elementsFromPoint(x, y)
    const tabItem = elements.find(el => el.classList.contains('tab-item'))
    
    if (tabItem) {
      const targetTabId = (tabItem as HTMLElement).dataset.tabid
      if (targetTabId && targetTabId !== tabId) {
        setTabs(prevTabs => {
          const newTabs = [...prevTabs]
          const sourceIndex = newTabs.findIndex(t => t.id === tabId)
          const targetIndex = newTabs.findIndex(t => t.id === targetTabId)
          if (sourceIndex > -1 && targetIndex > -1) {
            const [moved] = newTabs.splice(sourceIndex, 1)
            newTabs.splice(targetIndex, 0, moved)
          }
          return newTabs
        })
      }
      return
    }

    if (!terminalArea) return

    const r = terminalArea.getBoundingClientRect()
    const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

    if (!inside) {
      detachTab(tabId)
      return
    }

    const relX = x - r.left
    const relY = y - r.top
    const rightPct = relX / r.width
    const bottomPct = relY / r.height

    if (tabId === activeTabId) {
      return
    }

    if (rightPct > 0.8) {
      mergeTabAsSplit(tabId, 'horizontal')
    } else if (bottomPct > 0.8) {
      mergeTabAsSplit(tabId, 'vertical')
    }
  }

  return {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd
  }
}
