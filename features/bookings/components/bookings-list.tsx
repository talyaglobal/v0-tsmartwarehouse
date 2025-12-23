/**
 * Bookings List Component
 * Example Server Component using new patterns
 */

import { Suspense } from 'react'
import { getBookingsQuery } from '../lib/queries'
import { DefaultLoadingFallback } from '@/lib/server/suspense-boundary'
import { BookingsListClient } from './bookings-list-client'
import type { BookingFilters } from '../types'

interface BookingsListProps {
  filters?: BookingFilters
}

/**
 * Server Component that fetches data
 */
async function BookingsListData({ filters }: BookingsListProps) {
  const bookings = await getBookingsQuery(filters || {})

  return <BookingsListClient bookings={bookings} />
}

/**
 * Bookings List with Suspense boundary
 */
export function BookingsList(props: BookingsListProps) {
  return (
    <Suspense fallback={<DefaultLoadingFallback />}>
      <BookingsListData {...props} />
    </Suspense>
  )
}

