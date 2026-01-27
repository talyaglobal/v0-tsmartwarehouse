import { notFound } from 'next/navigation'
import { getWarehouseById } from '@/lib/services/warehouse-search-supabase'
import { getWarehouseReviews, getReviewSummary } from '@/lib/services/reviews'
import { WarehouseDetailView } from '@/components/marketplace/warehouse-detail-view'
import { getAvailabilityCalendar } from '@/lib/services/availability'
import Link from 'next/link'
import { Warehouse } from '@/components/icons'
import { PlatformAuthButtons } from '@/components/platform/platform-auth-buttons'
import { formatNumber } from '@/lib/utils/format'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function WarehouseDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const search = await searchParams

  // Fetch warehouse details
  const warehouse = await getWarehouseById(id)

  if (!warehouse) {
    notFound()
  }

  // Get availability if dates provided
  let availability = null
  if (search.start_date && search.end_date) {
    availability = await getAvailabilityCalendar(
      id,
      search.start_date as string,
      search.end_date as string
    )
  }

  // Get reviews
  const reviewsData = await getWarehouseReviews(id, 10, 0)
  const reviewSummary = await getReviewSummary(id)

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Warehouse className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Warebnb</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/find-warehouses" className="text-sm font-medium hover:text-primary transition-colors">
              Find Warehouses
            </Link>
            <Link href="/#services" className="text-sm font-medium hover:text-primary transition-colors">
              Services
            </Link>
            <Link href="/#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <PlatformAuthButtons />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <WarehouseDetailView 
            warehouse={warehouse} 
            availability={availability || undefined}
            reviews={reviewsData.reviews}
            reviewSummary={reviewSummary}
            searchParams={search}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold mb-4">Warebnb</h3>
              <p className="text-sm text-muted-foreground">
                The marketplace for warehouse space rental
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">For Guests</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/find-warehouses" className="text-muted-foreground hover:text-primary">
                    Find Warehouses
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/bookings" className="text-muted-foreground hover:text-primary">
                    My Bookings
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">For Hosts</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/dashboard/warehouses/new" className="text-muted-foreground hover:text-primary">
                    List Your Warehouse
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="text-muted-foreground hover:text-primary">
                    Host Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/#contact" className="text-muted-foreground hover:text-primary">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-muted-foreground hover:text-primary">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-muted-foreground hover:text-primary">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Warebnb. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const warehouse = await getWarehouseById(id)

  if (!warehouse) {
    return {
      title: 'Warehouse Not Found',
    }
  }

  return {
    title: `${warehouse.name} - Warehouse Rental | Warebnb`,
    description: `Rent warehouse space in ${warehouse.city}. ${formatNumber(warehouse.total_sq_ft)} sq ft available. ${warehouse.amenities?.join(', ') || ''}`,
  }
}
