import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function SessionNoteIndicator({ note, date, weekday, onEdit }: {
  note: string
  date: string
  weekday: string
  onEdit?: () => void
}) {
  const [position, setPosition] = useState<{ top: number; left: number }>()
  const container = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  const show = () => {
    const rect = container.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(320, window.innerWidth - 24)
    setPosition({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    })
  }

  useEffect(() => {
    if (!position) return
    const close = () => setPosition(undefined)
    const onScroll = (event: Event) => {
      if (event.target !== document.getElementById(tooltipId)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target) &&
        !document.getElementById(tooltipId)?.contains(event.target)) close()
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [position, tooltipId])

  return (
    <span
      className="session-note-indicator"
      ref={container}
      onMouseEnter={show}
      onMouseLeave={() => setPosition(undefined)}
    >
      <button
        type="button"
        className="session-note-trigger"
        aria-label={`${date.split('-').reverse().join('/')}, con annotazione${onEdit ? ': modifica sessione' : ''}`}
        aria-describedby={position ? tooltipId : undefined}
        onFocus={show}
        onBlur={() => setPosition(undefined)}
        onClick={onEdit ?? show}
      >
        <small>{weekday}</small>
        <strong>{date.slice(-2)}</strong>
      </button>
      {position && createPortal(
        <span id={tooltipId} role="tooltip" className="session-note-tooltip" style={position}>
          {note}
        </span>,
        document.body
      )}
    </span>
  )
}
