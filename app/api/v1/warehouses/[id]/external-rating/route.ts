import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { searchGoogleMapsPlace, searchGoogleMapsReviews } from "@/lib/crm-search/serpapi"

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select(
      "id, name, address, city, state, serpapi_place_id, external_rating, external_reviews_count, external_rating_updated_at"
    )
    .eq("id", id)
    .single()

  if (!warehouse) {
    return NextResponse.json({ success: false, error: "Warehouse not found" }, { status: 404 })
  }

  const updatedAt = warehouse.external_rating_updated_at
    ? new Date(warehouse.external_rating_updated_at).getTime()
    : 0
  if (updatedAt && Date.now() - updatedAt < MAX_AGE_MS && warehouse.external_rating != null) {
    return NextResponse.json({
      success: true,
      rating: warehouse.external_rating,
      reviewsCount: warehouse.external_reviews_count || 0,
      source: "google_maps",
    })
  }

  let placeId = warehouse.serpapi_place_id
  let rating: number | undefined
  let reviewsCount: number | undefined

  if (!placeId) {
    const query = `${warehouse.name} ${warehouse.address} ${warehouse.city} ${warehouse.state || ""}`.trim()
    const place = await searchGoogleMapsPlace({ query })
    placeId = place.placeId
    rating = place.rating
    reviewsCount = place.reviews
  }

  if (placeId) {
    const reviewInfo = await searchGoogleMapsReviews(placeId)
    rating = reviewInfo.rating ?? rating
    reviewsCount = reviewInfo.reviewsCount ?? reviewsCount
  }

  await supabase
    .from("warehouses")
    .update({
      serpapi_place_id: placeId || null,
      external_rating: rating ?? null,
      external_reviews_count: reviewsCount ?? null,
      external_rating_source: "google_maps",
      external_rating_updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  return NextResponse.json({
    success: true,
    rating: rating ?? null,
    reviewsCount: reviewsCount ?? 0,
    source: "google_maps",
  })
}
