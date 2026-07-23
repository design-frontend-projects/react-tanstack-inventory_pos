'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'

// Column board with optional pointer/touch drag-and-drop. Used by the KDS,
// delivery dispatch, and event-task boards. No external DnD dependency — a
// lightweight HTML5 drag model that is touch-friendly enough for POS tablets.

export interface KanbanColumn {
  id: string
  title: string
  tone?: StatusTone
  hint?: string
}

export interface KanbanCard {
  id: string
  columnId: string
}

export interface KanbanBoardProps<TCard extends KanbanCard> {
  columns: KanbanColumn[]
  cards: TCard[]
  renderCard: (card: TCard) => React.ReactNode
  // Fired when a card is dropped onto a different column.
  onCardMove?: (cardId: string, toColumnId: string) => void
  columnClassName?: string
  className?: string
  emptyColumnLabel?: string
}

export function KanbanBoard<TCard extends KanbanCard>({
  columns,
  cards,
  renderCard,
  onCardMove,
  columnClassName,
  className,
  emptyColumnLabel = 'No tickets',
}: KanbanBoardProps<TCard>) {
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [overColumn, setOverColumn] = React.useState<string | null>(null)

  const cardsByColumn = React.useMemo(() => {
    const map = new Map<string, TCard[]>()
    for (const column of columns) {
      map.set(column.id, [])
    }
    for (const card of cards) {
      const bucket = map.get(card.columnId)
      if (bucket) {
        bucket.push(card)
      }
    }
    return map
  }, [columns, cards])

  function handleDrop(columnId: string) {
    if (dragId && onCardMove) {
      const card = cards.find((item) => item.id === dragId)
      if (card && card.columnId !== columnId) {
        onCardMove(dragId, columnId)
      }
    }
    setDragId(null)
    setOverColumn(null)
  }

  return (
    <div
      className={cn(
        'flex gap-4 overflow-x-auto pb-2',
        className,
      )}
    >
      {columns.map((column) => {
        const columnCards = cardsByColumn.get(column.id) ?? []
        const isOver = overColumn === column.id
        return (
          <section
            key={column.id}
            className={cn(
              'flex min-w-72 flex-1 flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-3 transition-colors',
              isOver && 'border-primary/50 bg-primary/4',
              columnClassName,
            )}
            onDragOver={(event) => {
              if (dragId && onCardMove) {
                event.preventDefault()
                setOverColumn(column.id)
              }
            }}
            onDrop={() => handleDrop(column.id)}
          >
            <header className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <StatusChip tone={column.tone} dot>
                  {column.title}
                </StatusChip>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {columnCards.length}
                </span>
              </div>
              {column.hint ? (
                <span className="text-[0.7rem] text-muted-foreground">
                  {column.hint}
                </span>
              ) : null}
            </header>

            <div className="flex flex-col gap-2">
              {columnCards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {emptyColumnLabel}
                </p>
              ) : (
                columnCards.map((card) => (
                  <div
                    key={card.id}
                    draggable={Boolean(onCardMove)}
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverColumn(null)
                    }}
                    className={cn(
                      onCardMove && 'cursor-grab active:cursor-grabbing',
                      dragId === card.id && 'opacity-50',
                    )}
                  >
                    {renderCard(card)}
                  </div>
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
