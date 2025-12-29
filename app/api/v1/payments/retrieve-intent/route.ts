import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import type { ErrorResponse } from "@/types/api"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-10-28.acacia",
})

interface RetrieveIntentRequest {
  clientSecret: string
}

/**
 * POST /api/v1/payments/retrieve-intent
 * Retrieve payment intent details
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RetrieveIntentRequest

    if (!body.clientSecret) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Client secret is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Extract payment intent ID from client secret
    const paymentIntentId = body.clientSecret.split("_secret_")[0]

    // Retrieve payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    return NextResponse.json({
      success: true,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    })
  } catch (error) {
    console.error("Payment intent retrieval error:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve payment intent",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}
