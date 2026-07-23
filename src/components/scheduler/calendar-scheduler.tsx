'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'

// Month/week/day calendar + day-timeline grid for reservations and events.
// Pure CSS-grid — no external calendar dependency. The caller supplies events
// keyed by ISO date strings; all date math here is timezone-local.

export interface SchedulerEvent {
  id: string
  // ISO datetime (local) the event starts at.
  startsAt: string
  // Minutes; used by the day timeline. Defaults to 60.
  durationMinutes?: number
  title: string
  subtitle?: string
  tone?: StatusTone
}

export type SchedulerView = 'month' | 'week' | 'day'

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Monday-first week start to match hospitality scheduling conventions.
function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  const weekday = (day.getDay() + 6) % 7
  return addDays(day, -weekday)
}

function monthGridDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = startOfWeek(first)
  // 6 rows x 7 columns always covers a month.
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

export function CalendarScheduler({
  events,
  view,
  onViewChange,
  anchorDate,
  onAnchorDateChange,
  onEventClick,
  onSlotClick,
  dayStartHour = 8,
  dayEndHour = 24,
  className,
  locale,
}: {
  events: SchedulerEvent[]
  view: SchedulerView
  onViewChange: (view: SchedulerView) => void
  anchorDate: Date
  onAnchorDateChange: (date: Date) => void
  onEventClick?: (event: SchedulerEvent) => void
  // Fired when an empty day cell (month/week) or hour slot (day) is clicked.
  onSlotClick?: (date: Date) => void
  dayStartHour?: number
  dayEndHour?: number
  className?: string
  locale?: string
}) {
  const fmtMonth = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  })
  const fmtWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const fmtDay = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const fmtTime = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, SchedulerEvent[]>()
    for (const event of events) {
      const key = startOfDay(new Date(event.startsAt)).toDateString()
      const bucket = map.get(key) ?? []
      bucket.push(event)
      map.set(key, bucket)
    }
    for (const bucket of map.values()) {
      bucket.sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
    }
    return map
  }, [events])

  function shift(direction: -1 | 1) {
    if (view === 'month') {
      const next = new Date(anchorDate)
      next.setMonth(next.getMonth() + direction)
      onAnchorDateChange(next)
    } else if (view === 'week') {
      onAnchorDateChange(addDays(anchorDate, direction * 7))
    } else {
      onAnchorDateChange(addDays(anchorDate, direction))
    }
  }

  const today = startOfDay(new Date())

  const headerLabel =
    view === 'day' ? fmtDay.format(anchorDate) : fmtMonth.format(anchorDate)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Previous"
            onClick={() => shift(-1)}
          >
            ‹
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Next"
            onClick={() => shift(1)}
          >
            ›
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAnchorDateChange(new Date())}
          >
            Today
          </Button>
          <h3 className="ms-2 text-sm font-semibold">{headerLabel}</h3>
        </div>
        <div
          role="tablist"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1"
        >
          {(['month', 'week', 'day'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              onClick={() => onViewChange(option)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors',
                view === option
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {view === 'month' ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-2xl grid-cols-7 overflow-hidden rounded-2xl border border-border">
            {monthGridDays(anchorDate)
              .slice(0, 7)
              .map((day) => (
                <div
                  key={`h-${day.toDateString()}`}
                  className="border-b border-border bg-muted/40 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {fmtWeekday.format(day)}
                </div>
              ))}
            {monthGridDays(anchorDate).map((day) => {
              const inMonth = day.getMonth() === anchorDate.getMonth()
              const dayEvents = eventsByDay.get(day.toDateString()) ?? []
              return (
                <button
                  key={day.toDateString()}
                  type="button"
                  onClick={() => onSlotClick?.(day)}
                  className={cn(
                    'flex min-h-24 flex-col items-stretch gap-1 border-b border-e border-border/60 p-1.5 text-start align-top transition-colors last:border-e-0 hover:bg-muted/40',
                    !inMonth && 'bg-muted/20 text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'self-end rounded-full px-1.5 text-xs font-semibold tabular-nums',
                      isSameDay(day, today) &&
                        'bg-primary text-primary-foreground',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        onEventClick?.(event)
                      }}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                          keyEvent.preventDefault()
                          keyEvent.stopPropagation()
                          onEventClick?.(event)
                        }
                      }}
                      className="truncate rounded-md border border-primary/25 bg-primary/[0.07] px-1.5 py-0.5 text-[0.7rem] font-medium text-foreground hover:border-primary/50"
                    >
                      {fmtTime.format(new Date(event.startsAt))} {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="px-1 text-[0.68rem] text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Week view */}
      {view === 'week' ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-2xl grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, index) =>
              addDays(startOfWeek(anchorDate), index),
            ).map((day) => {
              const dayEvents = eventsByDay.get(day.toDateString()) ?? []
              return (
                <div
                  key={day.toDateString()}
                  className={cn(
                    'flex min-h-40 flex-col gap-1.5 rounded-2xl border border-border bg-card p-2',
                    isSameDay(day, today) && 'border-primary/40',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSlotClick?.(day)}
                    className="flex items-baseline justify-between gap-1 rounded-lg px-1 py-0.5 text-start hover:bg-muted/50"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {fmtWeekday.format(day)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-sm font-semibold tabular-nums',
                        isSameDay(day, today) &&
                          'bg-primary text-primary-foreground',
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-start text-xs hover:border-primary/50"
                    >
                      <span className="block font-semibold">
                        {fmtTime.format(new Date(event.startsAt))} —{' '}
                        {event.title}
                      </span>
                      {event.subtitle ? (
                        <span className="block truncate text-muted-foreground">
                          {event.subtitle}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Day timeline view */}
      {view === 'day' ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {Array.from(
            { length: dayEndHour - dayStartHour },
            (_, index) => dayStartHour + index,
          ).map((hour) => {
            const slotDate = new Date(anchorDate)
            slotDate.setHours(hour, 0, 0, 0)
            const slotEvents = (
              eventsByDay.get(startOfDay(anchorDate).toDateString()) ?? []
            ).filter((event) => new Date(event.startsAt).getHours() === hour)
            return (
              <div
                key={hour}
                className="grid grid-cols-[4.5rem_1fr] border-b border-border/60 last:border-0"
              >
                <div className="border-e border-border/60 bg-muted/30 px-2 py-2 text-end text-xs font-medium tabular-nums text-muted-foreground">
                  {fmtTime.format(slotDate)}
                </div>
                <button
                  type="button"
                  onClick={() => onSlotClick?.(slotDate)}
                  className="flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 text-start hover:bg-muted/30"
                >
                  {slotEvents.map((event) => (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        onEventClick?.(event)
                      }}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                          keyEvent.preventDefault()
                          keyEvent.stopPropagation()
                          onEventClick?.(event)
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] px-2 py-1 text-xs font-medium hover:border-primary/50"
                    >
                      <StatusChip tone={event.tone ?? 'primary'} dot>
                        {fmtTime.format(new Date(event.startsAt))}
                      </StatusChip>
                      {event.title}
                      {event.subtitle ? (
                        <span className="text-muted-foreground">
                          {event.subtitle}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
