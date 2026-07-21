'use client'

import * as React from 'react'
import { Toast as ToastPrimitive } from 'radix-ui'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react'

import { cn } from '#/lib/utils'
import { useToastStore } from '#/lib/toast/toast-store'
import type { ToastTone } from '#/lib/toast/toast-store'

const toneClassName: Record<ToastTone, string> = {
  success: 'border-emerald-300/60 bg-emerald-500/10',
  error: 'border-destructive/40 bg-destructive/10',
  warning: 'border-amber-300/60 bg-amber-500/10',
  info: 'border-sky-300/60 bg-sky-500/10',
}

const toneIcon: Record<
  ToastTone,
  React.ComponentType<{ className?: string }>
> = {
  success: CheckCircle2Icon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
}

const toneIconClassName: Record<ToastTone, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
}

// Global notification surface. Mounted once in the root document; every screen
// raises toasts through the `notify*` helpers in lib/toast/toast-store.
export function Toaster({ duration = 5000 }: { duration?: number }) {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <ToastPrimitive.Provider duration={duration} swipeDirection="right">
      {toasts.map((toast) => {
        const Icon = toneIcon[toast.tone]
        return (
          <ToastPrimitive.Root
            key={toast.id}
            open
            onOpenChange={(open) => {
              if (!open) {
                dismiss(toast.id)
              }
            }}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border bg-card p-4 shadow-lg backdrop-blur data-open:animate-in data-open:slide-in-from-right-4 data-closed:animate-out data-closed:fade-out-0',
              toneClassName[toast.tone],
            )}
          >
            <Icon
              className={cn('mt-0.5 size-4', toneIconClassName[toast.tone])}
            />
            <div className="flex flex-col gap-0.5">
              <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description ? (
                <ToastPrimitive.Description className="text-xs text-muted-foreground">
                  {toast.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss notification"
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 end-0 z-100 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  )
}
