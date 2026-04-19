import * as React from 'react'
import { cn } from '#/lib/utils'

type WorkspaceMetric = {
  label: string
  value: string
  hint: string
  tone?: 'teal' | 'amber' | 'neutral'
}

const toneClassName: Record<NonNullable<WorkspaceMetric['tone']>, string> = {
  teal: 'border-primary/20 bg-primary/[0.08]',
  amber: 'border-[color:var(--ops-amber-soft)] bg-[color:var(--ops-amber-soft)]',
  neutral: 'border-border/60 bg-background/50',
}

export function WorkspacePage({
  eyebrow,
  title,
  description,
  metrics,
  actions,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  metrics: WorkspaceMetric[]
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="ops-shell relative overflow-hidden rounded-[2rem] px-6 py-7 md:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-x-1/3 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <span className="ops-kicker">{eyebrow}</span>
            <h1 className="ops-title max-w-4xl text-4xl md:text-6xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              {description}
            </p>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className={cn(
                  'ops-panel rounded-[1.5rem] px-4 py-4',
                  toneClassName[metric.tone ?? 'neutral']
                )}
              >
                <p className="ops-panel-label">{metric.label}</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <strong className="text-3xl font-semibold tracking-tight">
                    {metric.value}
                  </strong>
                  <span className="max-w-[10rem] text-right text-xs leading-5 text-muted-foreground">
                    {metric.hint}
                  </span>
                </div>
              </article>
            ))}
          </div>
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
    <section className={cn('ops-panel rounded-[1.7rem] p-6', className)}>
      <div className="flex flex-col gap-3">
        <span className="ops-kicker">{eyebrow}</span>
        <div className="ops-rule" />
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}
