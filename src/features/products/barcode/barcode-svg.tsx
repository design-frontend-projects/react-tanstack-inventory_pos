'use client'

import * as React from 'react'
import { code128Layout } from '#/lib/barcode/code128'
import { cn } from '#/lib/utils'

// Inline Code 128 preview. Bars use currentColor so the barcode follows the
// surrounding text color; print output uses code128Svg (always black) instead.

interface BarcodeSvgProps {
  value: string
  height?: number
  moduleWidth?: number
  className?: string
}

export function BarcodeSvg({
  value,
  height = 48,
  moduleWidth = 2,
  className,
}: BarcodeSvgProps) {
  const layout = React.useMemo(() => {
    try {
      return code128Layout(value)
    } catch {
      return null
    }
  }, [value])

  if (!layout) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        This value cannot be encoded as Code 128 (printable ASCII only).
      </p>
    )
  }

  const totalWidth = layout.totalModules * moduleWidth

  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      viewBox={`0 0 ${totalWidth} ${height}`}
      className={cn('max-w-full', className)}
      style={{ height }}
    >
      {layout.bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x * moduleWidth}
          y={0}
          width={bar.width * moduleWidth}
          height={height}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}
