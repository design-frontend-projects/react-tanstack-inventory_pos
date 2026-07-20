'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'

// Multi-step wizard shell used by booking/creation flows (reservations, events,
// party, catering, promotions). Pure UI — the caller owns all form state and
// per-step validation; the wizard drives navigation and progress affordances.

export interface WizardStep {
  id: string
  title: string
  description?: string
  // Return an error message to block advancing past this step, or null when valid.
  validate?: () => string | null
}

export interface FormWizardProps {
  steps: WizardStep[]
  // Render the active step body. Steps are indexed by position.
  renderStep: (step: WizardStep, index: number) => React.ReactNode
  onComplete: () => void | Promise<void>
  onCancel?: () => void
  completeLabel?: string
  nextLabel?: string
  backLabel?: string
  cancelLabel?: string
  isPending?: boolean
  error?: string | null
  className?: string
}

export function FormWizard({
  steps,
  renderStep,
  onComplete,
  onCancel,
  completeLabel = 'Finish',
  nextLabel = 'Next',
  backLabel = 'Back',
  cancelLabel = 'Cancel',
  isPending = false,
  error,
  className,
}: FormWizardProps) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const [stepError, setStepError] = React.useState<string | null>(null)

  const activeStep = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  function goNext() {
    const validationError = activeStep.validate?.() ?? null
    if (validationError) {
      setStepError(validationError)
      return
    }
    setStepError(null)
    if (isLast) {
      void onComplete()
      return
    }
    setStepIndex((current) => Math.min(steps.length - 1, current + 1))
  }

  function goBack() {
    setStepError(null)
    setStepIndex((current) => Math.max(0, current - 1))
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* Progress rail */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Steps">
        {steps.map((step, index) => {
          const state =
            index < stepIndex
              ? 'done'
              : index === stepIndex
                ? 'active'
                : 'todo'
          return (
            <li key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                // Only completed steps are revisitable; jumping forward must
                // pass validation via the Next button.
                disabled={index > stepIndex}
                onClick={() => {
                  if (index < stepIndex) {
                    setStepError(null)
                    setStepIndex(index)
                  }
                }}
                aria-current={state === 'active' ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  state === 'active' &&
                    'border-primary/40 bg-primary/10 text-primary',
                  state === 'done' &&
                    'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
                  state === 'todo' &&
                    'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[0.65rem] font-bold',
                    state === 'active' && 'bg-primary text-primary-foreground',
                    state === 'done' && 'bg-emerald-500 text-white',
                    state === 'todo' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {state === 'done' ? '✓' : index + 1}
                </span>
                {step.title}
              </button>
              {index < steps.length - 1 ? (
                <span aria-hidden className="h-px w-4 bg-border" />
              ) : null}
            </li>
          )
        })}
      </ol>

      {/* Active step */}
      <section className="flex flex-col gap-4">
        {activeStep.description ? (
          <p className="text-sm text-muted-foreground">
            {activeStep.description}
          </p>
        ) : null}
        {renderStep(activeStep, stepIndex)}
        {stepError ?? error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {stepError ?? error}
          </p>
        ) : null}
      </section>

      {/* Navigation */}
      <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0 || isPending}
          >
            {backLabel}
          </Button>
          <Button type="button" onClick={goNext} disabled={isPending}>
            {isPending && isLast ? 'Saving…' : isLast ? completeLabel : nextLabel}
          </Button>
        </div>
      </footer>
    </div>
  )
}
