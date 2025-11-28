"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLocale } from "@/lib/i18n/hooks"
import { locales, localeConfigs, type Locale } from "@/lib/i18n/config"

export function LocaleSwitcher() {
  const { locale, changeLocale } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change language">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem key={loc} onClick={() => changeLocale(loc)} className={locale === loc ? "bg-accent" : ""}>
            <span className="mr-2">{getFlagEmoji(loc)}</span>
            {localeConfigs[loc].nativeName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getFlagEmoji(locale: Locale): string {
  const flags: Record<Locale, string> = {
    en: "🇺🇸",
    es: "🇪🇸",
    zh: "🇨🇳",
    fr: "🇫🇷",
    de: "🇩🇪",
    pt: "🇧🇷",
  }
  return flags[locale] || "🌐"
}
