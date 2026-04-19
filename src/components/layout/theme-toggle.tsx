"use client"

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { LaptopMinimal, MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from 'next-themes'

const themeOptions = [
  { value: 'light', label: 'Light', icon: SunMedium },
  { value: 'dark', label: 'Dark', icon: MoonStar },
  { value: 'system', label: 'System', icon: LaptopMinimal },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted
    ? themeOptions.find((option) => option.value === theme)
    : undefined
  const ActiveIcon = activeTheme?.icon ?? LaptopMinimal
  const currentThemeLabel = !mounted
    ? t('theme.options.system')
    : resolvedTheme === 'dark'
      ? t('theme.current.night')
      : t('theme.current.day')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'justify-start rounded-full border-border/60 bg-background/75 px-3 text-muted-foreground shadow-none',
            className
          )}
        >
          <ActiveIcon data-icon="inline-start" />
          {currentThemeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          {themeOptions.map((option) => {
            const Icon = option.icon
            return (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => setTheme(option.value)}
              >
                <Icon />
                {t(`theme.options.${option.value}`)}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
