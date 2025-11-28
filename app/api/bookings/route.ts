import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: "No company associated" }, { status: 400 })
    }

    const body = await request.json()
    const { type, booking_date, start_time, duration_days, container_number, seal_number, notes, products } = body

    // Get warehouse
    const { data: warehouse } = await supabase.from("warehouses").select("id").eq("is_active", true).single()

    if (!warehouse) {
      return NextResponse.json({ error: "No warehouse available" }, { status: 400 })
    }

    // Calculate total price
    const baseRates: Record<string, Record<string, number>> = {
      GENERAL: { STANDARD: 15, OVERSIZED: 22 },
      AMBIENT_FOOD: { STANDARD: 18, OVERSIZED: 26 },
      ELECTRONICS: { STANDARD: 25, OVERSIZED: 35 },
      FRAGILE: { STANDARD: 30, OVERSIZED: 42 },
      FROZEN: { STANDARD: 35, OVERSIZED: 50 },
    }

    let totalPrice = 0
    const productData = products.map(
      (p: {
        product_type: string
        pallet_size: string
        weight_kg: number
        height_cm: number
        quantity: number
        description: string
      }) => {
        const baseRate = baseRates[p.product_type]?.[p.pallet_size] || 15
        const weightCharge = p.weight_kg * 0.05
        const heightCharge = p.height_cm * 0.1
        const lineTotal = (baseRate + weightCharge + heightCharge) * p.quantity * duration_days
        totalPrice += lineTotal

        return {
          product_type: p.product_type,
          pallet_size: p.pallet_size,
          weight_kg: p.weight_kg,
          height_cm: p.height_cm,
          quantity: p.quantity,
          description: p.description,
          base_price: baseRate,
          weight_charge: weightCharge,
          height_charge: heightCharge,
          line_total: lineTotal,
        }
      },
    )

    // Add tax
    const tax = totalPrice * 0.07
    totalPrice += tax

    // Create booking
    const startDateTime = new Date(`${booking_date}T${start_time}:00`)
    const endDateTime = new Date(startDateTime)
    endDateTime.setDate(endDateTime.getDate() + duration_days)

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        company_id: profile.company_id,
        warehouse_id: warehouse.id,
        type,
        booking_date,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration_days,
        pallets_count: products.reduce((sum: number, p: { quantity: number }) => sum + p.quantity, 0),
        containers_count: type === "CONTAINER" ? 1 : 0,
        container_number,
        seal_number,
        notes,
        total_price: totalPrice,
        status: "DRAFT",
      })
      .select()
      .single()

    if (bookingError) {
      console.error("Booking error:", bookingError)
      return NextResponse.json({ error: bookingError.message }, { status: 500 })
    }

    // Create products
    const productsToInsert = productData.map((p: Record<string, unknown>) => ({
      ...p,
      booking_id: booking.id,
    }))

    const { error: productsError } = await supabase.from("products").insert(productsToInsert)

    if (productsError) {
      console.error("Products error:", productsError)
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, products(*)")
      .eq("company_id", profile?.company_id || "")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
