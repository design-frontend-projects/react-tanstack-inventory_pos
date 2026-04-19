"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PreferencesState = {
  activeTenantId: string | null
  setActiveTenantId: (tenantId: string) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      setActiveTenantId: (tenantId) => set({ activeTenantId: tenantId }),
    }),
    {
      name: 'inventory-pos-preferences',
      partialize: (state) => ({
        activeTenantId: state.activeTenantId,
      }),
    }
  )
)
