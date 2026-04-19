import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from '#/features/preferences/preferences-store'

describe('preferences store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    usePreferencesStore.persist.clearStorage()
    usePreferencesStore.setState({
      activeTenantId: null,
    })
  })

  it('persists the active tenant', () => {
    usePreferencesStore.getState().setActiveTenantId('tenant-meridian')

    expect(usePreferencesStore.getState().activeTenantId).toBe('tenant-meridian')

    const persistedState = window.localStorage.getItem(
      'inventory-pos-preferences'
    )

    expect(persistedState).toContain('"activeTenantId":"tenant-meridian"')
  })
})
