/**
 * Marketplace-specific type definitions
 */

// =====================================================
// SEARCH TYPES
// =====================================================

export interface WarehouseSearchParams {
  // Location-based search
  lat?: number
  lng?: number
  radius_km?: number
  city?: string
  state?: string
  zipCode?: string
  
  // Booking requirements
  type?: 'pallet' | 'area-rental'
  quantity?: number
  start_date?: string
  end_date?: string
  
  // Filters
  warehouse_type?: string[]
  storage_type?: string[]
  temperature_types?: string[]
  amenities?: string[] // Legacy - kept for backward compatibility
  security?: string[]
  min_price?: number
  max_price?: number
  min_rating?: number
  
  // Pagination & sorting
  page?: number
  limit?: number
  sort_by?: 'price' | 'distance' | 'rating' | 'availability' | 'name'
  sort_order?: 'asc' | 'desc'
}

export interface WarehouseSearchResult {
  id: string
  name: string
  address: string
  city: string
  state?: string
  zipCode?: string
  latitude: number
  longitude: number
  distance_km?: number
  
  total_sq_ft: number
  available_sq_ft: number
  total_pallet_storage: number
  available_pallet_storage: number
  
  warehouse_type: string
  storage_type: string
  temperature_types: string[]
  amenities: string[]
  description?: string
  photos: string[]
  
  min_price: number
  average_pallet_price?: number // Average price per pallet per day
  pricing: {
    type: string
    price: number
    unit: string
  }[]
  palletPricing?: MarketplacePalletPricing[]
  external_rating?: number
  external_reviews_count?: number
  external_rating_source?: string
  
  average_rating: number
  total_reviews: number
  
  company_name: string
  company_logo?: string
  is_verified: boolean
  
  // Additional warehouse details
  custom_status?: 'antrepolu' | 'regular'
  min_pallet?: number
  max_pallet?: number
  min_sq_ft?: number
  max_sq_ft?: number
  rent_methods?: string[]
  security?: string[]
  video_url?: string
  videos?: string[] // Array of video URLs (YouTube, Vimeo, or uploaded files)
  access_info?: {
    accessType?: string
    accessControl?: string
    [key: string]: any
  }
  product_acceptance_start_time?: string
  product_acceptance_end_time?: string
  working_days?: string[]
  operating_hours?: {
    open?: string
    close?: string
    days?: string[]
    [key: string]: any
  }
  warehouse_in_fee?: number
  warehouse_out_fee?: number
  ports?: Array<{
    name: string
    container40DC?: number
    container40HC?: number
    container20DC?: number
    [key: string]: any
  }>
}

export interface SearchResponse {
  warehouses: WarehouseSearchResult[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// =====================================================
// AVAILABILITY TYPES
// =====================================================

export interface AvailabilityCheck {
  warehouse_id: string
  type: 'pallet' | 'area-rental'
  quantity: number
  start_date: string
  end_date: string
}

export interface AvailabilityResult {
  available: boolean
  requested_quantity: number
  available_quantity: number
  utilization_percent: number
  conflicting_dates?: string[]
}

export interface WarehouseAvailability {
  warehouseId: string
  date: string // ISO date string
  availableSqFt: number
  availablePallets: number
  isAvailable: boolean
  bookings?: BookingConflict[]
}

export interface BookingConflict {
  bookingId: string
  startDate: string
  endDate: string
  type: 'pallet' | 'area-rental'
  quantity: number
}

// =====================================================
// REVIEW TYPES
// =====================================================

export interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  reviewer_name: string
  reviewer_avatar?: string
  reviewee_id: string
  warehouse_id: string
  review_type: 'guest_to_host' | 'host_to_guest'
  overall_rating: number
  communication_rating?: number
  accuracy_rating?: number
  location_rating?: number
  value_rating?: number
  cleanliness_rating?: number
  title?: string
  content?: string
  pros?: string[]
  cons?: string[]
  host_response?: string
  host_response_at?: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface ReviewSummary {
  warehouse_id: string
  total_reviews: number
  average_rating: number
  average_communication: number
  average_accuracy: number
  average_location: number
  average_value: number
  average_cleanliness: number
  rating_distribution: {
    '1': number
    '2': number
    '3': number
    '4': number
    '5': number
  }
  last_review_at?: string
}

// =====================================================
// MESSAGING TYPES
// =====================================================

export interface Conversation {
  id: string
  booking_id?: string
  warehouse_id: string
  warehouse_name: string
  host_id: string
  host_name: string
  guest_id: string
  guest_name: string
  subject?: string
  status: 'active' | 'archived' | 'blocked'
  last_message_at?: string
  last_message_preview?: string
  unread_count: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system' | 'booking_request' | 'booking_update'
  attachments?: {
    url: string
    filename: string
    size: number
    type: string
  }[]
  metadata?: Record<string, any>
  is_read: boolean
  read_at?: string
  is_deleted: boolean
  created_at: string
}

// =====================================================
// INQUIRY TYPES
// =====================================================

export interface Inquiry {
  id: string
  warehouse_id: string
  warehouse_name: string
  guest_id: string
  guest_name: string
  interested_type?: 'pallet' | 'area-rental'
  interested_quantity?: number
  interested_start_date?: string
  interested_end_date?: string
  message: string
  inquiry_status: 'pending' | 'responded' | 'converted' | 'expired' | 'declined'
  responded_at?: string
  converted_booking_id?: string
  created_at: string
  updated_at: string
}

// =====================================================
// FAVORITES TYPES
// =====================================================

export interface Favorite {
  id: string
  user_id: string
  warehouse_id: string
  warehouse?: WarehouseSearchResult
  notes?: string
  created_at: string
}

// =====================================================
// PRICING TYPES
// =====================================================

export interface WarehousePricing {
  id: string
  warehouseId: string
  pricingType: 'pallet' | 'pallet-monthly' | 'area' | 'area-rental'
  basePrice: number
  unit: string
  volumeDiscounts?: VolumeDiscount[]
  createdAt: Date
  updatedAt: Date
}

export interface VolumeDiscount {
  minQuantity: number
  maxQuantity?: number
  discountPercent: number
  pricePerUnit: number
}

export interface PriceCalculation {
  warehouse_id: string
  type: 'pallet' | 'area-rental'
  quantity: number
  start_date: string
  end_date: string
  pallet_details?: PalletBookingDetails
}

export interface PriceBreakdown {
  base_price: number
  quantity: number
  days: number
  billable_days?: number
  free_days?: number
  subtotal: number
  volume_discount: number
  discount_percent: number
  total: number
  currency: string
}

export interface PalletBookingDetails {
  goods_type: string
  stackable: boolean
  pallets: PalletBookingItem[]
}

export interface PalletBookingItem {
  pallet_type: 'standard' | 'euro' | 'custom'
  quantity: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
  weight_kg?: number
}

export interface MarketplacePalletPricing {
  id?: string
  palletType: 'standard' | 'euro' | 'custom'
  pricingPeriod: 'day' | 'week' | 'month'
  goodsType?: string
  stackable?: boolean
  stackableAdjustmentType?: 'rate' | 'plus_per_unit'
  stackableAdjustmentValue?: number
  unstackableAdjustmentType?: 'rate' | 'plus_per_unit'
  unstackableAdjustmentValue?: number
  customDimensions?: {
    length: number
    width: number
    height: number
    unit?: 'cm' | 'in'
  }
  heightRanges?: Array<{
    id?: string
    heightMinCm: number
    heightMaxCm: number
    pricePerUnit: number
  }>
  weightRanges?: Array<{
    id?: string
    weightMinKg: number
    weightMaxKg: number
    pricePerPallet: number
  }>
}

// =====================================================
// PAYOUT TYPES
// =====================================================

export interface HostPayout {
  id: string
  host_id: string
  company_id: string
  booking_id: string
  invoice_id?: string
  gross_amount: number
  platform_fee: number
  net_amount: number
  currency: string
  stripe_transfer_id?: string
  stripe_payout_id?: string
  stripe_connected_account_id?: string
  payout_status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
  scheduled_date?: string
  processed_at?: string
  failed_reason?: string
  created_at: string
  updated_at: string
}

// =====================================================
// LISTING TYPES
// =====================================================

export interface WarehouseListing {
  id: string
  name: string
  address: string
  city: string
  state?: string
  zipCode: string
  latitude?: number
  longitude?: number
  
  // Capacity
  totalSqFt: number
  totalPalletStorage?: number
  availableSqFt: number
  availablePalletStorage?: number
  
  // Types
  warehouseType: string
  storageType: string
  temperatureTypes: string[]
  
  // Features
  amenities: string[]
  photos: string[]
  description?: string
  
  // Status
  status: boolean
  isVerified?: boolean
  
  // Pricing (from warehouse_pricing table)
  pricing: WarehousePricing[]
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  companyId?: string
}

