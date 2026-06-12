import { useRef, useState } from 'react'

/**
 * Drag-to-reorder for a grid or list using native HTML5 drag & drop (works
 * with mouse on desktop and long-press drag on iOS Safari). Render from
 * `list` — while a drag is in progress it shows the live preview order — and
 * spread `itemProps(index)` on each item's container. `onCommit` fires once,
 * with the final order, when the drag ends and the order actually changed.
 */
export function useDragReorder<T>(items: T[], onCommit: (next: T[]) => void, enabled = true) {
  const [view, setView] = useState<T[] | null>(null)
  const fromIndex = useRef<number | null>(null)

  const list = view ?? items

  function finish() {
    const next = view
    setView(null)
    fromIndex.current = null
    if (next && next.some((item, i) => item !== items[i])) onCommit(next)
  }

  function itemProps(index: number) {
    if (!enabled) return {}
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        fromIndex.current = index
        setView(items)
        e.dataTransfer.effectAllowed = 'move'
        // Firefox and iOS Safari only start the drag if some data is set.
        e.dataTransfer.setData('text/plain', String(index))
      },
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault()
        const from = fromIndex.current
        if (from == null || from === index) return
        setView((v) => {
          const next = [...(v ?? items)]
          const [moved] = next.splice(from, 1)
          next.splice(index, 0, moved)
          return next
        })
        fromIndex.current = index
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        finish()
      },
      onDragEnd: finish,
    }
  }

  return {
    list,
    /** True while the user is dragging an item of this list. */
    dragging: view != null,
    /** True for the item currently being dragged (to dim it). */
    isDragSource: (index: number) => view != null && fromIndex.current === index,
    itemProps,
  }
}
