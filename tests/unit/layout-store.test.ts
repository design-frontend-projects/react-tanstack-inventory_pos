import { beforeEach, describe, expect, it } from 'vitest'
import { useLayoutStore } from '#/features/layout/layout-store'
import { LAYOUT_STORAGE_KEY } from '#/lib/layout/constants'

describe('layout store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useLayoutStore.persist.clearStorage()
    useLayoutStore.setState({
      locale: 'en',
      direction: 'ltr',
      sidebarOpen: true,
      sidebarOpenMobile: false,
    })
  })

  it('syncs locale direction and persists desktop layout state', () => {
    useLayoutStore.getState().setLocale('ar')
    useLayoutStore.getState().setSidebarOpen(false)
    useLayoutStore.getState().setSidebarOpenMobile(true)

    expect(useLayoutStore.getState().locale).toBe('ar')
    expect(useLayoutStore.getState().direction).toBe('rtl')
    expect(useLayoutStore.getState().sidebarOpen).toBe(false)
    expect(useLayoutStore.getState().sidebarOpenMobile).toBe(true)

    const persistedState = window.localStorage.getItem(LAYOUT_STORAGE_KEY)

    expect(persistedState).toContain('"locale":"ar"')
    expect(persistedState).toContain('"direction":"rtl"')
    expect(persistedState).toContain('"sidebarOpen":false')
    expect(persistedState).not.toContain('sidebarOpenMobile')
  })
})
