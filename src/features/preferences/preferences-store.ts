"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppLocale } from '#/types/app'

type PreferencesState = {
  activeTenantId: string | null
  locale: AppLocale
  setActiveTenantId: (tenantId: string) => void
  setLocale: (locale: AppLocale) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      locale: 'en',
      setActiveTenantId: (tenantId) => set({ activeTenantId: tenantId }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'inventory-pos-preferences',
      partialize: (state) => ({
        activeTenantId: state.activeTenantId,
        locale: state.locale,
      }),
    }
  )
)
