/**
 * React hooks for fetching countries and cities from API
 */

import { useQuery } from "@tanstack/react-query"
import type { Country, City } from "@/lib/api/countries-cities"

/**
 * Hook to fetch all countries
 */
export function useCountries() {
  return useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const response = await fetch('/api/v1/countries')
      if (!response.ok) throw new Error('Failed to fetch countries')
      const data = await response.json()
      return data.data
    },
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours (countries don't change often)
  })
}

/**
 * Hook to fetch cities for a country
 */
export function useCities(countryCode: string | null) {
  return useQuery<City[]>({
    queryKey: ['cities', countryCode],
    queryFn: async () => {
      if (!countryCode) return []
      const response = await fetch(`/api/v1/countries/${countryCode}/cities`)
      if (!response.ok) throw new Error('Failed to fetch cities')
      const data = await response.json()
      return data.data
    },
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (cities don't change often)
  })
}

