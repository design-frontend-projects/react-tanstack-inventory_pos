"use client"

import * as React from 'react'
import { TooltipProvider } from '#/components/ui/tooltip'
import { Toaster } from '#/components/feedback/toaster'
import { useLayoutStore } from '#/features/layout/layout-store'
import i18n, { applyLocaleDocument, resolveLocale } from '#/lib/i18n'
import { AppQueryProvider } from '#/lib/query/query-client'
import { ThemeProvider } from '#/lib/theme/theme-provider'

function LocaleRuntimeSync() {
  const locale = useLayoutStore((state) => state.locale)
  const direction = useLayoutStore((state) => state.direction)

  React.useEffect(() => {
    const nextLocale = resolveLocale(locale)
    applyLocaleDocument(nextLocale, direction)

    if (i18n.language !== nextLocale) {
      void i18n.changeLanguage(nextLocale)
    }
  }, [direction, locale])

  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppQueryProvider>
        <TooltipProvider>
          <LocaleRuntimeSync />
          {children}
          <Toaster />
        </TooltipProvider>
      </AppQueryProvider>
    </ThemeProvider>
  )
}
