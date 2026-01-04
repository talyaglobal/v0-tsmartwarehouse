/**
 * Reviews Service
 * 
 * Handles review CRUD operations and review summary updates
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Review, ReviewSummary } from '@/types/marketplace'

/**
 * Get reviews for a warehouse
 */
export async function getWarehouseReviews(
  warehouseId: string,
  limit = 10,
  offset = 0
): Promise<{ reviews: Review[]; total: number }> {
  const supabase = createServerSupabaseClient()

  try {
    const { data: reviews, error, count } = await supabase
      .from('warehouse_reviews')
      .select(
        `
        *,
        profiles!warehouse_reviews_user_id_fkey(id, name, avatar_url)
      `,
        { count: 'exact' }
      )
      .eq('warehouse_id', warehouseId)
      .eq('is_published', true)
      .eq('status', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    const transformedReviews: Review[] = (reviews || []).map((r: any) => ({
      id: r.id,
      booking_id: r.booking_id,
      reviewer_id: r.user_id,
      reviewer_name: r.profiles?.name || 'Anonymous',
      reviewer_avatar: r.profiles?.avatar_url,
      reviewee_id: r.reviewee_id || r.user_id,
      warehouse_id: r.warehouse_id,
      review_type: r.review_type || 'guest_to_host',
      overall_rating: r.rating,
      communication_rating: r.communication_rating,
      accuracy_rating: r.accuracy_rating,
      location_rating: r.location_rating,
      value_rating: r.value_rating,
      cleanliness_rating: r.cleanliness_rating,
      title: r.title,
      content: r.comment,
      pros: r.pros,
      cons: r.cons,
      host_response: r.host_response,
      host_response_at: r.host_response_at,
      is_published: r.is_published,
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
  const supabase = createServerSupabaseClient()

  try {
    const { data: summary, error } = await supabase
      .from('warehouse_review_summary')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .single()

    if (error || !summary) {
      return null
    }

    return {
      warehouse_id: summary.warehouse_id,
      total_reviews: summary.total_reviews || 0,
      average_rating: parseFloat(summary.average_rating) || 0,
      average_communication: parseFloat(summary.average_communication) || 0,
      average_accuracy: parseFloat(summary.average_accuracy) || 0,
      average_location: parseFloat(summary.average_location) || 0,
      average_value: parseFloat(summary.average_value) || 0,
      average_cleanliness: parseFloat(summary.average_cleanliness) || 0,
      rating_distribution: summary.rating_distribution || {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      },
      last_review_at: summary.last_review_at,
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
  const supabase = createServerSupabaseClient()

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
  const supabase = createServerSupabaseClient()

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

