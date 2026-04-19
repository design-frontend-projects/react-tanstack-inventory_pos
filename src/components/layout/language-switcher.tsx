"use client"

import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { useLayoutStore } from '#/features/layout/layout-store'
import { localeMeta } from '#/lib/i18n'
import type { AppLocale } from '#/types/app'
import { Globe2 } from 'lucide-react'

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const locale = useLayoutStore((state) => state.locale)
  const setLocale = useLayoutStore((state) => state.setLocale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('actions.language')}
          className="justify-start rounded-full border-border/60 bg-background/75 px-3 text-muted-foreground shadow-none"
        >
          <Globe2 data-icon="inline-start" />
          {localeMeta[locale].nativeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          {(Object.keys(localeMeta) as AppLocale[]).map((code) => (
            <DropdownMenuItem key={code} onSelect={() => setLocale(code)}>
              <span className="flex min-w-8 justify-center text-xs font-semibold uppercase text-muted-foreground">
                {code}
              </span>
              {localeMeta[code].nativeLabel}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
