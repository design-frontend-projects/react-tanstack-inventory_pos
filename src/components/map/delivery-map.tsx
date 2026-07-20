'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'

// Lightweight, dependency-free dispatch map: an SVG panel plotting delivery
// stops and drivers on normalized coordinates with optional zone polygons.
// A real map provider (Leaflet/MapLibre) can replace the projection later —
// the props contract is designed so callers won't change.

export interface MapPoint {
  id: string
  // Normalized coordinates in [0, 1] relative to the viewport. When wiring a
  // real geo provider, project lat/lng into this space at the call site.
  x: number
  y: number
  label: string
  kind: 'stop' | 'driver' | 'store'
  tone?: StatusTone
}

export interface MapZone {
  id: string
  label: string
  // Normalized polygon vertices.
  points: Array<{ x: number; y: number }>
  tone?: StatusTone
}

export interface MapRoute {
  id: string
  // Ordered point ids to connect with a polyline.
  pointIds: string[]
}

const toneFill: Record<StatusTone, string> = {
  neutral: 'var(--muted-foreground)',
  info: 'var(--chart-2)',
  warning: 'var(--chart-4)',
  success: 'var(--chart-3)',
  danger: 'var(--destructive)',
  primary: 'var(--primary)',
}

export function DeliveryMap({
  points,
  zones = [],
  routes = [],
  onPointClick,
  selectedPointId,
  className,
  aspect = 16 / 10,
  emptyLabel = 'No active deliveries to plot.',
}: {
  points: MapPoint[]
  zones?: MapZone[]
  routes?: MapRoute[]
  onPointClick?: (point: MapPoint) => void
  selectedPointId?: string | null
  className?: string
  aspect?: number
  emptyLabel?: string
}) {
  const width = 1000
  const height = Math.round(width / aspect)
  const pointById = React.useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  )

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-muted/30',
        className,
      )}
    >
      {points.length === 0 ? (
        <p className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Delivery dispatch map"
          className="block w-full"
        >
          {/* Subtle grid so the panel reads as a map surface */}
          {Array.from({ length: 9 }, (_, index) => (
            <line
              key={`v-${index}`}
              x1={((index + 1) * width) / 10}
              y1={0}
              x2={((index + 1) * width) / 10}
              y2={height}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}
          {Array.from({ length: 7 }, (_, index) => (
            <line
              key={`h-${index}`}
              x1={0}
              y1={((index + 1) * height) / 8}
              x2={width}
              y2={((index + 1) * height) / 8}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {/* Zones */}
          {zones.map((zone) => (
            <g key={zone.id}>
              <polygon
                points={zone.points
                  .map((vertex) => `${vertex.x * width},${vertex.y * height}`)
                  .join(' ')}
                fill={toneFill[zone.tone ?? 'info']}
                opacity={0.08}
                stroke={toneFill[zone.tone ?? 'info']}
                strokeOpacity={0.35}
                strokeWidth={1.5}
              />
              {zone.points.length > 0 ? (
                <text
                  x={
                    (zone.points.reduce((sum, vertex) => sum + vertex.x, 0) /
                      zone.points.length) *
                    width
                  }
                  y={
                    (zone.points.reduce((sum, vertex) => sum + vertex.y, 0) /
                      zone.points.length) *
                    height
                  }
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--muted-foreground)"
                >
                  {zone.label}
                </text>
              ) : null}
            </g>
          ))}

          {/* Routes */}
          {routes.map((route) => {
            const coords = route.pointIds
              .map((id) => pointById.get(id))
              .filter((point): point is MapPoint => Boolean(point))
            if (coords.length < 2) {
              return null
            }
            return (
              <polyline
                key={route.id}
                points={coords
                  .map((point) => `${point.x * width},${point.y * height}`)
                  .join(' ')}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.5}
                strokeDasharray="6 5"
                opacity={0.7}
              />
            )
          })}

          {/* Points */}
          {points.map((point) => {
            const cx = point.x * width
            const cy = point.y * height
            const selected = point.id === selectedPointId
            const fill = toneFill[point.tone ?? 'primary']
            return (
              <g
                key={point.id}
                role={onPointClick ? 'button' : undefined}
                tabIndex={onPointClick ? 0 : undefined}
                onClick={() => onPointClick?.(point)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onPointClick?.(point)
                  }
                }}
                style={{ cursor: onPointClick ? 'pointer' : undefined }}
              >
                {selected ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={16}
                    fill={fill}
                    opacity={0.18}
                  />
                ) : null}
                {point.kind === 'store' ? (
                  <rect
                    x={cx - 8}
                    y={cy - 8}
                    width={16}
                    height={16}
                    rx={4}
                    fill={fill}
                  />
                ) : point.kind === 'driver' ? (
                  <polygon
                    points={`${cx},${cy - 9} ${cx + 8},${cy + 7} ${cx - 8},${cy + 7}`}
                    fill={fill}
                  />
                ) : (
                  <circle cx={cx} cy={cy} r={7} fill={fill} />
                )}
                <text
                  x={cx}
                  y={cy + 22}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--foreground)"
                >
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 start-2 flex flex-wrap gap-1.5">
        <StatusChip tone="primary" dot className="bg-card/90">
          Stop
        </StatusChip>
        <StatusChip tone="info" dot className="bg-card/90">
          Driver
        </StatusChip>
        <StatusChip tone="neutral" dot className="bg-card/90">
          Store
        </StatusChip>
      </div>
    </div>
  )
}
