import * as React from 'react'
import { cn } from '#/lib/utils'

export type WorkspaceMetric = {
  label: string
  value: string
  hint: string
  tone?: 'red' | 'accent' | 'neutral'
}

export type WorkspacePageVariant = 'hero' | 'compact'

const toneClassName: Record<NonNullable<WorkspaceMetric['tone']>, string> = {
  red: 'border-primary/25 bg-primary/[0.06]',
  accent:
    'border-[color:var(--ops-amber-soft)] bg-[color:var(--ops-amber-soft)]',
  neutral: 'border-border bg-card',
}

function WorkspaceMetricStrip({
  metrics,
  variant,
}: {
  metrics: WorkspaceMetric[]
  variant: WorkspacePageVariant
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        variant === 'hero'
          ? 'md:grid-cols-3 xl:grid-cols-1'
          : 'md:grid-cols-3 xl:grid-cols-1',
      )}
    >
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className={cn(
            'rounded-xl border px-4 py-4',
            toneClassName[metric.tone ?? 'neutral'],
          )}
        >
          <p className="ops-panel-label">{metric.label}</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <strong
              className={cn(
                'font-semibold tracking-tight',
                variant === 'hero' ? 'text-3xl' : 'text-[1.9rem]',
              )}
            >
              {metric.value}
            </strong>
            <span className="max-w-40 text-right text-xs leading-5 text-muted-foreground">
              {metric.hint}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}

export function WorkspacePage({
  eyebrow,
  title,
  description,
  metrics,
  actions,
  children,
  variant = 'compact',
}: {
  eyebrow: string
  title: string
  description: string
  metrics: WorkspaceMetric[]
  actions?: React.ReactNode
  children: React.ReactNode
  variant?: WorkspacePageVariant
}) {
  const isHero = variant === 'hero'

  return (
    <div className="flex flex-col gap-6">
      <section
        className={cn(
          'relative overflow-hidden rounded-2xl',
          isHero
            ? 'ops-shell px-6 py-7 md:px-8 md:py-8'
            : 'ops-panel px-5 py-5 md:px-6 md:py-6',
        )}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />
        <div
          className={cn(
            'grid gap-6',
            isHero
              ? 'xl:grid-cols-[1.15fr_0.85fr]'
              : 'xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]',
          )}
        >
          <div className="flex flex-col gap-4">
            <span className="ops-kicker">{eyebrow}</span>
            <h1
              className={cn(
                'text-balance',
                isHero
                  ? 'ops-title max-w-4xl text-3xl md:text-5xl'
                  : 'max-w-4xl text-2xl font-semibold tracking-tight md:text-4xl',
              )}
            >
              {title}
            </h1>
            <p
              className={cn(
                'max-w-3xl text-sm leading-7 text-muted-foreground',
                isHero ? 'md:text-base' : 'md:text-[0.95rem]',
              )}
            >
              {description}
            </p>
            {actions ? (
              <div className="flex flex-wrap gap-3">{actions}</div>
            ) : null}
          </div>
          <WorkspaceMetricStrip metrics={metrics} variant={variant} />
        </div>
      </section>

      <div className="ops-section-grid">{children}</div>
    </div>
  )
}

export function WorkspacePanel({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('ops-panel rounded-2xl p-5 md:p-6', className)}>
      <div className="flex flex-col gap-3">
        <span className="ops-kicker">{eyebrow}</span>
        <div className="ops-rule" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function WorkspaceDetailCard({
  title,
  description,
  meta,
  className,
}: {
  title: string
  description: string
  meta?: string
  className?: string
}) {
  return (
    <article className={cn('pin-card p-4', className)}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {meta ? (
        <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {meta}
        </p>
      ) : null}
    </article>
  )
}

export function WorkspaceTimelineItem({
  leading,
  title,
  description,
  className,
}: {
  leading: string
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <div className="min-w-14 text-sm font-semibold">{leading}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function WorkspaceEmptyState({
  title,
  description,
  children,
  className,
}: {
  title: string
  description: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border bg-muted/60 p-5 text-sm',
        className,
      )}
    >
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}
