'use client'

import { create } from 'zustand'

// Module-level toast queue so non-React code (mutation callbacks, services)
// can raise notifications without threading a hook through the tree.

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastRecord {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastState {
  toasts: ToastRecord[]
  push: (toast: Omit<ToastRecord, 'id'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

let counter = 0

function nextId(): string {
  counter += 1
  return `toast-${counter}`
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    return id
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

function push(tone: ToastTone, title: string, description?: string): string {
  return useToastStore.getState().push({ tone, title, description })
}

export function notifySuccess(title: string, description?: string): string {
  return push('success', title, description)
}

export function notifyInfo(title: string, description?: string): string {
  return push('info', title, description)
}

export function notifyWarning(title: string, description?: string): string {
  return push('warning', title, description)
}

// Accepts unknown so mutation onError handlers can pass the raw rejection value.
export function notifyError(
  error: unknown,
  title = 'Something went wrong',
): string {
  return push('error', title, getErrorMessage(error))
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unexpected error. Please try again.'
}
