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
      
      const data = await response.json().catch(() => ({}))
      
      if (!response.ok || !data.success) {
        const errorMessage = data.error || data.message || 'Failed to fetch cities'
        
        // If account is not enabled, include helpful message
        if (response.status === 403 || errorMessage.includes('not enabled') || errorMessage.includes('enable it on your account')) {
          throw new Error(
            'GeoNames account not enabled for webservice. Please ask the administrator to enable it at https://www.geonames.org/manageaccount'
          )
        }
        
        // If it's a rate limit error, include helpful message
        if (response.status === 429 || errorMessage.includes('rate limit')) {
          throw new Error(
            'GeoNames API rate limit exceeded. Please ask the administrator to register at https://www.geonames.org/login and set GEONAMES_USERNAME in .env.local'
          )
        }
        throw new Error(errorMessage)
      }
      
      return data.data || []
    },
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (cities don't change often)
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  })
}

