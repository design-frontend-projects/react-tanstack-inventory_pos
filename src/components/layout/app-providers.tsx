"use client"

import * as React from 'react'
import { TooltipProvider } from '#/components/ui/tooltip'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import i18n, { applyLocaleDocument, resolveLocale } from '#/lib/i18n'
import { AppQueryProvider } from '#/lib/query/query-client'
import { ThemeProvider } from '#/lib/theme/theme-provider'

function LocaleRuntimeSync() {
  const locale = usePreferencesStore((state) => state.locale)

  React.useEffect(() => {
    const nextLocale = resolveLocale(locale)
    applyLocaleDocument(nextLocale)

    if (i18n.language !== nextLocale) {
      void i18n.changeLanguage(nextLocale)
    }
  }, [locale])

  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppQueryProvider>
        <TooltipProvider>
          <LocaleRuntimeSync />
          {children}
        </TooltipProvider>
      </AppQueryProvider>
    </ThemeProvider>
  )
}
