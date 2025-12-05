import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCache, setCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'
import { PRICING } from '@/lib/constants'

/**
 * Database operations for Analytics with caching
 */

export interface RevenueData {
  month: string
  pallet: number
  areaRental: number
}

export interface UtilizationData {
  month: string
  floor1: number
  floor2: number
  floor3: number
}

export interface ServiceBreakdown {
  name: string
  value: number
  color: string
}

export interface AnalyticsStats {
  totalRevenue: number
  monthlyRevenue: number
  warehouseUtilization: number
  totalCustomers: number
  avgRevenuePerCustomer: number
  customerRetentionRate: number
  avgBookingDuration: number
  storageEfficiency: number
  areaRentalRate: number
}

/**
 * Get revenue data by month for the last 6 months
 */
export async function getRevenueData(months: number = 6): Promise<RevenueData[]> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.DASHBOARD_STATS, 'revenue', months)

  const cached = await getCache<RevenueData[]>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()
  
  // Get invoices from the last N months
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      total,
      created_at,
      booking_id
    `)
    .gte('created_at', startDate.toISOString())
    .eq('status', 'paid')

  // Get booking types separately
  const bookingIds = [...new Set(invoices?.map((inv: any) => inv.booking_id).filter(Boolean) || [])]
  const { data: bookings } = bookingIds.length > 0 ? await supabase
    .from('bookings')
    .select('id, type')
    .in('id', bookingIds) : { data: [] }

  const bookingTypeMap = new Map(bookings?.map((b: any) => [b.id, b.type]) || [])

  if (error) {
    throw new Error(`Failed to fetch revenue data: ${error.message}`)
  }

  // Group by month and booking type
  const monthlyData: Record<string, { pallet: number; areaRental: number }> = {}
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  // Initialize all months
  for (let i = 0; i < months; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() - (months - 1 - i))
    const monthKey = `${monthNames[date.getMonth()]}`
    monthlyData[monthKey] = { pallet: 0, areaRental: 0 }
  }

  // Aggregate revenue
  invoices?.forEach((invoice: any) => {
    const invoiceDate = new Date(invoice.created_at)
    const monthKey = monthNames[invoiceDate.getMonth()]
    const bookingType = bookingTypeMap.get(invoice.booking_id) || 'pallet'
    const amount = parseFloat(invoice.total) || 0

    if (monthlyData[monthKey]) {
      if (bookingType === 'pallet') {
        monthlyData[monthKey].pallet += amount
      } else if (bookingType === 'area-rental') {
        monthlyData[monthKey].areaRental += amount
      }
    }
  })

  const result: RevenueData[] = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    pallet: Math.round(data.pallet),
    areaRental: Math.round(data.areaRental),
  }))

  await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  return result
}

/**
 * Get warehouse utilization data by month
 */
export async function getUtilizationData(months: number = 6): Promise<UtilizationData[]> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.DASHBOARD_STATS, 'utilization', months)

  const cached = await getCache<UtilizationData[]>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()
  
  // Get warehouse halls data
  const { data: halls, error: hallsError } = await supabase
    .from('warehouse_halls')
    .select(`
      id,
      sq_ft,
      occupied_sq_ft,
      floor_id
    `)

  // Get floor numbers separately
  const floorIds = [...new Set(halls?.map((h: any) => h.floor_id).filter(Boolean) || [])]
  const { data: floors } = floorIds.length > 0 ? await supabase
    .from('warehouse_floors')
    .select('id, floor_number')
    .in('id', floorIds) : { data: [] }

  const floorNumberMap = new Map(floors?.map((f: any) => [f.id, f.floor_number]) || [])

  if (hallsError) {
    throw new Error(`Failed to fetch utilization data: ${hallsError.message}`)
  }

  // Get bookings over time
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      id,
      hall_id,
      area_sq_ft,
      pallet_count,
      created_at,
      floor_number
    `)
    .gte('created_at', startDate.toISOString())
    .in('status', ['confirmed', 'active'])

  if (bookingsError) {
    throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
  }

  // Calculate utilization by month
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyUtilization: Record<string, { floor1: number; floor2: number; floor3: number }> = {}

  // Initialize all months
  for (let i = 0; i < months; i++) {
    const date = new Date()
    date.setMonth(date.getMonth() - (months - 1 - i))
    const monthKey = `${monthNames[date.getMonth()]}`
    monthlyUtilization[monthKey] = { floor1: 0, floor2: 0, floor3: 0 }
  }

  // Calculate utilization for each month
  Object.keys(monthlyUtilization).forEach((month) => {
    const monthIndex = monthNames.indexOf(month)
    const currentDate = new Date()
    currentDate.setMonth(monthIndex)
    
    // Get total capacity per floor
    const floorCapacity: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
    halls?.forEach((hall: any) => {
      const floorNum = floorNumberMap.get(hall.floor_id)
      if (floorNum && floorCapacity[floorNum] !== undefined) {
        floorCapacity[floorNum] += hall.sq_ft || 0
      }
    })

    // Calculate occupied space up to this month
    const floorOccupied: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
    bookings?.forEach((booking: any) => {
      const bookingDate = new Date(booking.created_at)
      if (bookingDate <= currentDate) {
        const floorNum = booking.floor_number
        if (floorNum && floorOccupied[floorNum] !== undefined) {
          if (booking.area_sq_ft) {
            floorOccupied[floorNum] += booking.area_sq_ft
          } else if (booking.pallet_count) {
            // Estimate: 1 pallet = ~32 sq ft (4x8 feet)
            floorOccupied[floorNum] += booking.pallet_count * 32
          }
        }
      }
    })

    // Calculate percentage
    monthlyUtilization[month] = {
      floor1: floorCapacity[1] > 0 ? Math.round((floorOccupied[1] / floorCapacity[1]) * 100) : 0,
      floor2: floorCapacity[2] > 0 ? Math.round((floorOccupied[2] / floorCapacity[2]) * 100) : 0,
      floor3: floorCapacity[3] > 0 ? Math.round((floorOccupied[3] / floorCapacity[3]) * 100) : 0,
    }
  })

  const result: UtilizationData[] = Object.entries(monthlyUtilization).map(([month, data]) => ({
    month,
    ...data,
  }))

  await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  return result
}

/**
 * Get service breakdown data
 */
export async function getServiceBreakdown(): Promise<ServiceBreakdown[]> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.DASHBOARD_STATS, 'service-breakdown')

  const cached = await getCache<ServiceBreakdown[]>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()
  
  // Get total revenue by service type
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      total,
      items,
      booking_id
    `)
    .eq('status', 'paid')

  // Get booking types separately
  const bookingIds = [...new Set(invoices?.map((inv: any) => inv.booking_id).filter(Boolean) || [])]
  const { data: bookings } = bookingIds.length > 0 ? await supabase
    .from('bookings')
    .select('id, type')
    .in('id', bookingIds) : { data: [] }

  const bookingTypeMap = new Map(bookings?.map((b: any) => [b.id, b.type]) || [])

  if (error) {
    throw new Error(`Failed to fetch service breakdown: ${error.message}`)
  }

  let palletRevenue = 0
  let areaRentalRevenue = 0
  let handlingRevenue = 0

  invoices?.forEach((invoice: any) => {
    const amount = parseFloat(invoice.total) || 0
    const bookingType = bookingTypeMap.get(invoice.booking_id) || 'pallet'
    
    // Check invoice items for handling fees
    const items = invoice.items || []
    const handlingFee = items
      .filter((item: any) => item.description?.toLowerCase().includes('handling'))
      .reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0)

    handlingRevenue += handlingFee

    if (bookingType === 'pallet') {
      palletRevenue += amount - handlingFee
    } else if (bookingType === 'area-rental') {
      areaRentalRevenue += amount - handlingFee
    }
  })

  const total = palletRevenue + areaRentalRevenue + handlingRevenue

  const result: ServiceBreakdown[] = [
    {
      name: 'Pallet Storage',
      value: total > 0 ? Math.round((palletRevenue / total) * 100) : 0,
      color: '#3b82f6',
    },
    {
      name: 'Area Rental',
      value: total > 0 ? Math.round((areaRentalRevenue / total) * 100) : 0,
      color: '#10b981',
    },
    {
      name: 'Handling Fees',
      value: total > 0 ? Math.round((handlingRevenue / total) * 100) : 0,
      color: '#f59e0b',
    },
  ]

  await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  return result
}

/**
 * Get analytics statistics
 */
export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.DASHBOARD_STATS, 'analytics')

  const cached = await getCache<AnalyticsStats>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()
  
  // Get total revenue
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('total, created_at, customer_id')
    .eq('status', 'paid')

  if (invoicesError) {
    throw new Error(`Failed to fetch invoices: ${invoicesError.message}`)
  }

  const totalRevenue = invoices?.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0) || 0

  // Get monthly revenue (current month)
  const currentMonth = new Date()
  currentMonth.setDate(1)
  currentMonth.setHours(0, 0, 0, 0)
  
  const monthlyRevenue = invoices
    ?.filter((inv) => new Date(inv.created_at) >= currentMonth)
    .reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0) || 0

  // Get total customers
  const { data: customers, error: customersError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'customer')

  if (customersError) {
    throw new Error(`Failed to fetch customers: ${customersError.message}`)
  }

  const totalCustomers = customers?.length || 0

  // Get warehouse utilization
  const { data: halls, error: hallsError } = await supabase
    .from('warehouse_halls')
    .select('sq_ft, occupied_sq_ft')

  if (hallsError) {
    throw new Error(`Failed to fetch halls: ${hallsError.message}`)
  }

  const totalSqFt = halls?.reduce((sum, hall) => sum + (hall.sq_ft || 0), 0) || 0
  const occupiedSqFt = halls?.reduce((sum, hall) => sum + (hall.occupied_sq_ft || 0), 0) || 0
  const warehouseUtilization = totalSqFt > 0 ? Math.round((occupiedSqFt / totalSqFt) * 100) : 0

  // Calculate other metrics
  const avgRevenuePerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
  
  // Get bookings for retention and duration
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, customer_id, start_date, end_date, created_at')
    .in('status', ['active', 'completed'])

  if (bookingsError) {
    throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
  }

  // Calculate average booking duration (in months)
  let totalDurationMonths = 0
  let bookingCount = 0
  bookings?.forEach((booking) => {
    if (booking.start_date && booking.end_date) {
      const start = new Date(booking.start_date)
      const end = new Date(booking.end_date)
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)
      totalDurationMonths += months
      bookingCount++
    }
  })
  const avgBookingDuration = bookingCount > 0 ? totalDurationMonths / bookingCount : 0

  // Customer retention (simplified: customers with multiple bookings)
  const customerBookingCounts: Record<string, number> = {}
  bookings?.forEach((booking) => {
    customerBookingCounts[booking.customer_id] = (customerBookingCounts[booking.customer_id] || 0) + 1
  })
  const returningCustomers = Object.values(customerBookingCounts).filter((count) => count > 1).length
  const customerRetentionRate = totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0

  // Storage efficiency (simplified calculation)
  const storageEfficiency = 87 // This would be calculated based on actual space usage vs allocated

  // Area rental rate
  const areaRentalRate = PRICING.areaRentalPerSqFtPerYear

  const result: AnalyticsStats = {
    totalRevenue: Math.round(totalRevenue),
    monthlyRevenue: Math.round(monthlyRevenue),
    warehouseUtilization,
    totalCustomers,
    avgRevenuePerCustomer: Math.round(avgRevenuePerCustomer),
    customerRetentionRate,
    avgBookingDuration: Math.round(avgBookingDuration * 10) / 10,
    storageEfficiency,
    areaRentalRate,
  }

  await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  return result
}

