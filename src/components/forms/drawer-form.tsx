'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Button } from '#/components/ui/button'

// Standardized side-drawer form (create/edit) built on Sheet, matching the
// Dialog-form conventions (useState + native <form> + mutation.mutateAsync).

export function DrawerForm({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isPending = false,
  error,
  children,
  side = 'right',
  className,
  submitDisabled = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onSubmit: () => void | Promise<void>
  submitLabel?: string
  cancelLabel?: string
  isPending?: boolean
  error?: string | null
  children: React.ReactNode
  side?: 'right' | 'left'
  className?: string
  submitDisabled?: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn('w-full sm:max-w-lg', className)}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit()
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {children}
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isPending || submitDisabled}>
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// Field label wrapper shared by drawer + dialog forms.
export function Field({
  label,
  htmlFor,
  hint,
  required = false,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

export const fieldInputClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'
