import { notFound } from 'next/navigation'
import { getWarehouseById } from '@/lib/services/warehouse-search-supabase'
import { getWarehouseReviews, getReviewSummary } from '@/lib/services/reviews'
import { WarehouseDetailView } from '@/components/marketplace/warehouse-detail-view'
import { getAvailabilityCalendar } from '@/lib/services/availability'

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
    <div className="container mx-auto px-4 py-8">
      <WarehouseDetailView 
        warehouse={warehouse} 
        availability={availability || undefined}
        reviews={reviewsData.reviews}
        reviewSummary={reviewSummary}
        searchParams={search}
      />
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
    title: `${warehouse.name} - Warehouse Rental | TSmart Warehouse`,
    description: `Rent warehouse space in ${warehouse.city}. ${warehouse.total_sq_ft?.toLocaleString()} sq ft available. ${warehouse.amenities?.join(', ') || ''}`,
  }
}

