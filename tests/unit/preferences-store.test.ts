import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from '#/features/preferences/preferences-store'

describe('preferences store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    usePreferencesStore.persist.clearStorage()
    usePreferencesStore.setState({
      activeTenantId: null,
      locale: 'en',
    })
  })

  it('persists the active tenant and locale', () => {
    usePreferencesStore.getState().setActiveTenantId('tenant-meridian')
    usePreferencesStore.getState().setLocale('ar')

    expect(usePreferencesStore.getState().activeTenantId).toBe('tenant-meridian')
    expect(usePreferencesStore.getState().locale).toBe('ar')

    const persistedState = window.localStorage.getItem(
      'inventory-pos-preferences'
    )

    expect(persistedState).toContain('"activeTenantId":"tenant-meridian"')
    expect(persistedState).toContain('"locale":"ar"')
  })
})
