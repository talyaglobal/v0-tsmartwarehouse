"use client"

import { useCallback, useState } from "react"
import { type Locale, defaultLocale, localeConfigs, t as translate } from "./config"

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("locale") as Locale
      if (stored && localeConfigs[stored]) {
        return stored
      }

      const browserLang = navigator.language.split("-")[0] as Locale
      if (localeConfigs[browserLang]) {
        return browserLang
      }
    }
    return defaultLocale
  })

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", newLocale)
      document.documentElement.lang = newLocale
      document.documentElement.dir = localeConfigs[newLocale].direction
    }
  }, [])

  const t = useCallback((key: string) => translate(key, locale), [locale])

  const formatCurrency = useCallback(
    (amount: number) => {
      const config = localeConfigs[locale]
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: config.currency,
      }).format(amount)
    },
    [locale],
  )

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === "string" ? new Date(date) : date
      return new Intl.DateTimeFormat(locale, options).format(d)
    },
    [locale],
  )

  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale, options).format(num)
    },
    [locale],
  )

  const formatRelativeTime = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date
      const now = new Date()
      const diffMs = d.getTime() - now.getTime()
      const diffSec = Math.round(diffMs / 1000)
      const diffMin = Math.round(diffSec / 60)
      const diffHour = Math.round(diffMin / 60)
      const diffDay = Math.round(diffHour / 24)

      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

      if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second")
      if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
      if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour")
      return rtf.format(diffDay, "day")
    },
    [locale],
  )

  return {
    locale,
    config: localeConfigs[locale],
    changeLocale,
    t,
    formatCurrency,
    formatDate,
    formatNumber,
    formatRelativeTime,
  }
}
