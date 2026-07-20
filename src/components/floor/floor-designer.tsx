'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'

// Interactive floor canvas: drag/resize tables and shapes on a normalized
// [0,1] coordinate space with zoom + pan and an optional mini-map. Pure UI —
// callers own the item list and persist positions on drag/resize end.
// Reused by the floor-plan editor, event hall layouts, and party seating.

export type FloorItemShape = 'round' | 'rect'

export interface FloorItem {
  id: string
  label: string
  sublabel?: string
  shape: FloorItemShape
  // Normalized center position and size, all in [0, 1] canvas space.
  x: number
  y: number
  w: number
  h: number
  // Tailwind classes controlling the item chrome (status coloring).
  className?: string
  locked?: boolean
}

export interface FloorDesignerProps {
  items: FloorItem[]
  // Editable mode enables drag + resize; omit for a read-only live floor.
  onItemChange?: (item: FloorItem) => void
  onItemClick?: (item: FloorItem) => void
  selectedItemId?: string | null
  aspect?: number
  className?: string
  showMiniMap?: boolean
  emptyLabel?: string
}

interface DragState {
  mode: 'move' | 'resize'
  itemId: string
  pointerId: number
  startX: number
  startY: number
  origin: FloorItem
}

const MIN_SIZE = 0.03

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function FloorDesigner({
  items,
  onItemChange,
  onItemClick,
  selectedItemId,
  aspect = 16 / 10,
  className,
  showMiniMap = true,
  emptyLabel = 'No tables placed yet.',
}: FloorDesignerProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [drag, setDrag] = React.useState<DragState | null>(null)
  // Local override during a drag so the interaction stays smooth without
  // re-rendering through the caller on every pointermove.
  const [draft, setDraft] = React.useState<FloorItem | null>(null)
  const panRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: { x: number; y: number }
  } | null>(null)

  const editable = Boolean(onItemChange)

  function canvasSize() {
    const node = canvasRef.current
    return node
      ? { width: node.clientWidth, height: node.clientHeight }
      : { width: 1, height: 1 }
  }

  function applyDrag(event: React.PointerEvent, state: DragState): FloorItem {
    const { width, height } = canvasSize()
    const dx = (event.clientX - state.startX) / (width * zoom)
    const dy = (event.clientY - state.startY) / (height * zoom)
    if (state.mode === 'move') {
      return {
        ...state.origin,
        x: clamp(state.origin.x + dx, state.origin.w / 2, 1 - state.origin.w / 2),
        y: clamp(state.origin.y + dy, state.origin.h / 2, 1 - state.origin.h / 2),
      }
    }
    const w = clamp(state.origin.w + dx, MIN_SIZE, 1)
    const h = clamp(state.origin.h + dy, MIN_SIZE, 1)
    return {
      ...state.origin,
      w,
      h,
      x: clamp(state.origin.x + (w - state.origin.w) / 2, w / 2, 1 - w / 2),
      y: clamp(state.origin.y + (h - state.origin.h) / 2, h / 2, 1 - h / 2),
    }
  }

  function beginDrag(
    event: React.PointerEvent,
    item: FloorItem,
    mode: DragState['mode'],
  ) {
    if (!editable || item.locked) {
      return
    }
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    setDrag({
      mode,
      itemId: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
    })
    setDraft(item)
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (drag && event.pointerId === drag.pointerId) {
      setDraft(applyDrag(event, drag))
      return
    }
    const panState = panRef.current
    if (panState && event.pointerId === panState.pointerId) {
      setPan({
        x: panState.origin.x + (event.clientX - panState.startX),
        y: panState.origin.y + (event.clientY - panState.startY),
      })
    }
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (drag && event.pointerId === drag.pointerId) {
      const finalItem = applyDrag(event, drag)
      setDrag(null)
      setDraft(null)
      onItemChange?.(finalItem)
      return
    }
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
    }
  }

  const renderItems = items.map((item) =>
    draft && draft.id === item.id ? draft : item,
  )

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Zoom controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => setZoom((current) => clamp(current - 0.2, 0.6, 2.4))}
          >
            −
          </Button>
          <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            onClick={() => setZoom((current) => clamp(current + 0.2, 0.6, 2.4))}
          >
            +
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
          >
            Reset
          </Button>
        </div>
        {editable ? (
          <span className="text-xs text-muted-foreground">
            Drag to move · corner handle to resize · empty space to pan
          </span>
        ) : null}
      </div>

      {/* Canvas */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-muted/30"
        style={{ aspectRatio: String(aspect) }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerDown={(event) => {
          // Pan on background drag.
          if (event.target === event.currentTarget.firstElementChild) {
            ;(event.target as Element).setPointerCapture(event.pointerId)
            panRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              origin: pan,
            }
          }
        }}
      >
        <div
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            backgroundImage:
              'radial-gradient(circle, var(--border) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {renderItems.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            renderItems.map((item) => {
              const selected = item.id === selectedItemId
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={item.label}
                  onPointerDown={(event) => beginDrag(event, item, 'move')}
                  onClick={() => onItemClick?.(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onItemClick?.(item)
                    }
                  }}
                  className={cn(
                    'absolute flex flex-col items-center justify-center border-2 text-center transition-shadow select-none',
                    item.shape === 'round' ? 'rounded-full' : 'rounded-xl',
                    editable && !item.locked
                      ? 'cursor-grab active:cursor-grabbing'
                      : 'cursor-pointer',
                    selected
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-border hover:border-primary/50',
                    item.className ?? 'bg-card',
                  )}
                  style={{
                    left: `${(item.x - item.w / 2) * 100}%`,
                    top: `${(item.y - item.h / 2) * 100}%`,
                    width: `${item.w * 100}%`,
                    height: `${item.h * 100}%`,
                  }}
                >
                  <span className="truncate px-1 text-xs font-bold">
                    {item.label}
                  </span>
                  {item.sublabel ? (
                    <span className="truncate px-1 text-[0.65rem] text-muted-foreground">
                      {item.sublabel}
                    </span>
                  ) : null}
                  {editable && !item.locked ? (
                    <span
                      aria-hidden
                      onPointerDown={(event) =>
                        beginDrag(event, item, 'resize')
                      }
                      className="absolute -bottom-1 -end-1 size-3.5 cursor-nwse-resize rounded-full border-2 border-primary bg-card"
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        {/* Mini map */}
        {showMiniMap && renderItems.length > 0 ? (
          <div className="pointer-events-none absolute bottom-2 end-2 h-16 w-24 overflow-hidden rounded-lg border border-border bg-card/85">
            {renderItems.map((item) => (
              <span
                key={item.id}
                className={cn(
                  'absolute bg-muted-foreground/60',
                  item.shape === 'round' ? 'rounded-full' : 'rounded-[2px]',
                  item.id === selectedItemId && 'bg-primary',
                )}
                style={{
                  left: `${(item.x - item.w / 2) * 100}%`,
                  top: `${(item.y - item.h / 2) * 100}%`,
                  width: `${item.w * 100}%`,
                  height: `${item.h * 100}%`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
