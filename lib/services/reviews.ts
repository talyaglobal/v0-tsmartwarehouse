/**
 * Reviews Service
 * 
 * Handles review CRUD operations and review summary updates
 */

import { createServerClient } from '@/lib/kolaybase/server'
import type { Review, ReviewSummary } from '@/types/marketplace'

/**
 * Get reviews for a warehouse
 */
export async function getWarehouseReviews(
  warehouseId: string,
  limit = 10,
  offset = 0
): Promise<{ reviews: Review[]; total: number }> {
  const supabase = createServerClient()

  try {
    const { data: reviews, error, count } = await supabase
      .from('warehouse_reviews')
      .select('id, warehouse_id, booking_id, user_id, rating, title, comment, host_response, host_response_at, created_at, updated_at', { count: 'exact' })
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    const transformedReviews: Review[] = (reviews || []).map((r: any) => ({
      id: r.id,
      booking_id: r.booking_id,
      reviewer_id: r.user_id,
      reviewer_name: 'Anonymous',
      reviewer_avatar: undefined,
      reviewee_id: r.user_id,
      warehouse_id: r.warehouse_id,
      review_type: 'guest_to_host',
      overall_rating: r.rating,
      title: r.title,
      content: r.comment,
      host_response: r.host_response,
      host_response_at: r.host_response_at,
      is_published: true,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))

    return {
      reviews: transformedReviews,
      total: count || 0,
    }
  } catch (error) {
    console.error('[reviews] Error fetching reviews:', error)
    return { reviews: [], total: 0 }
  }
}

/**
 * Get review summary for a warehouse
 */
export async function getReviewSummary(warehouseId: string): Promise<ReviewSummary | null> {
  const supabase = createServerClient()

  try {
    // No summary view — compute from warehouse_reviews directly
    const { data: reviews, error } = await supabase
      .from('warehouse_reviews')
      .select('rating, created_at')
      .eq('warehouse_id', warehouseId)

    if (error || !reviews || reviews.length === 0) {
      return null
    }

    const total = reviews.length
    const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / total
    const dist: { '1': number; '2': number; '3': number; '4': number; '5': number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    reviews.forEach((r: any) => { dist[String(r.rating)] = (dist[String(r.rating)] || 0) + 1 })
    const lastReview = reviews.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    return {
      warehouse_id: warehouseId,
      total_reviews: total,
      average_rating: Math.round(avg * 10) / 10,
      average_communication: 0,
      average_accuracy: 0,
      average_location: 0,
      average_value: 0,
      average_cleanliness: 0,
      rating_distribution: dist,
      last_review_at: lastReview?.created_at,
    }
  } catch (error) {
    console.error('[reviews] Error fetching review summary:', error)
    return null
  }
}

/**
 * Create a review
 */
export async function createReview(review: Partial<Review>): Promise<Review | null> {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from('warehouse_reviews')
      .insert({
        warehouse_id: review.warehouse_id,
        booking_id: review.booking_id,
        user_id: review.reviewer_id,
        reviewee_id: review.reviewee_id,
        review_type: review.review_type || 'guest_to_host',
        rating: review.overall_rating,
        communication_rating: review.communication_rating,
        accuracy_rating: review.accuracy_rating,
        location_rating: review.location_rating,
        value_rating: review.value_rating,
        cleanliness_rating: review.cleanliness_rating,
        title: review.title,
        comment: review.content,
        pros: review.pros,
        cons: review.cons,
        is_published: review.is_published ?? true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // The trigger will automatically update the review summary
    return {
      id: data.id,
      booking_id: data.booking_id,
      reviewer_id: data.user_id,
      reviewer_name: '',
      reviewee_id: data.reviewee_id || data.user_id,
      warehouse_id: data.warehouse_id,
      review_type: data.review_type,
      overall_rating: data.rating,
      communication_rating: data.communication_rating,
      accuracy_rating: data.accuracy_rating,
      location_rating: data.location_rating,
      value_rating: data.value_rating,
      cleanliness_rating: data.cleanliness_rating,
      title: data.title,
      content: data.comment,
      pros: data.pros,
      cons: data.cons,
      is_published: data.is_published,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  } catch (error) {
    console.error('[reviews] Error creating review:', error)
    throw error
  }
}

/**
 * Update host response to a review
 */
export async function updateHostResponse(
  reviewId: string,
  response: string
): Promise<Review | null> {
  const supabase = createServerClient()

  try {
    const { data, error } = await supabase
      .from('warehouse_reviews')
      .update({
        host_response: response,
        host_response_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Fetch reviewer profile for response
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', data.user_id)
      .single()

    return {
      id: data.id,
      booking_id: data.booking_id,
      reviewer_id: data.user_id,
      reviewer_name: profile?.name || 'Anonymous',
      reviewer_avatar: profile?.avatar_url,
      reviewee_id: data.reviewee_id || data.user_id,
      warehouse_id: data.warehouse_id,
      review_type: data.review_type,
      overall_rating: data.rating,
      communication_rating: data.communication_rating,
      accuracy_rating: data.accuracy_rating,
      location_rating: data.location_rating,
      value_rating: data.value_rating,
      cleanliness_rating: data.cleanliness_rating,
      title: data.title,
      content: data.comment,
      pros: data.pros,
      cons: data.cons,
      host_response: data.host_response,
      host_response_at: data.host_response_at,
      is_published: data.is_published,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  } catch (error) {
    console.error('[reviews] Error updating host response:', error)
    throw error
  }
}

