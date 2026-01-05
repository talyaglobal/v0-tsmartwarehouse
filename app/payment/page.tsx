"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Warehouse as WarehouseIcon, Loader2 } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"

export default function PaymentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [amount, setAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const clientSecret = searchParams.get("intent")
  const bookingId = searchParams.get("bookingId")

  useEffect(() => {
    // If bookingId is provided, create payment intent from booking
    if (bookingId && !clientSecret) {
      const createPaymentFromBooking = async () => {
        try {
          setLoading(true)
          // First, get the booking
          const bookingResponse = await fetch(`/api/v1/bookings/${bookingId}`, {
            credentials: 'include',
          })
          const bookingData = await bookingResponse.json()
          
          if (!bookingData.success || !bookingData.data) {
            router.push("/dashboard/bookings")
            return
          }

          const booking = bookingData.data

          // Get invoice for this booking
          const invoiceResponse = await fetch(`/api/v1/invoices?bookingId=${bookingId}`, {
            credentials: 'include',
          })
          const invoiceData = await invoiceResponse.json()

          let invoiceId: string | null = null
          if (invoiceData.success && invoiceData.data && invoiceData.data.length > 0) {
            invoiceId = invoiceData.data[0].id
          }

          // If no invoice exists, create one first
          if (!invoiceId) {
            try {
              const generateInvoiceResponse = await fetch("/api/v1/invoices/generate-from-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                  bookingId: bookingId,
                }),
              })
              const generateInvoiceData = await generateInvoiceResponse.json()
              
              if (generateInvoiceData.success && generateInvoiceData.data) {
                invoiceId = generateInvoiceData.data.id
              } else {
                console.error("Failed to generate invoice:", generateInvoiceData.error)
                // Still try to proceed with payment using booking amount
              }
            } catch (error) {
              console.error("Failed to generate invoice:", error)
              // Continue with payment attempt using booking amount
            }
          }

          // If we still don't have an invoiceId, we cannot proceed
          if (!invoiceId) {
            console.error("Invoice is required for payment")
            setErrorMessage("Unable to create invoice for this booking. Please contact support.")
            setLoading(false)
            return
          }

          // Create payment intent via processInvoicePayment
          const paymentResponse = await fetch("/api/v1/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({
              invoiceId: invoiceId,
              paymentMethod: "card",
            }),
          })
          const paymentData = await paymentResponse.json()
          
          if (paymentData.success && paymentData.clientSecret) {
            // Redirect with clientSecret
            router.push(`/payment?intent=${paymentData.clientSecret}&bookingId=${bookingId}`)
          } else {
            console.error("Failed to create payment:", paymentData.error)
            setErrorMessage(paymentData.error || "Failed to create payment. Please try again.")
            setLoading(false)
          }
        } catch (error) {
          console.error("Failed to create payment from booking:", error)
          setErrorMessage(error instanceof Error ? error.message : "Failed to create payment. Please try again.")
          setLoading(false)
        }
      }

      createPaymentFromBooking()
      return
    }

    // If clientSecret is provided, retrieve payment intent and booking amount
    if (clientSecret && bookingId) {
      const retrieveIntent = async () => {
        try {
          setLoading(true)
          
          // Get booking to show the correct amount
          const bookingResponse = await fetch(`/api/v1/bookings/${bookingId}`, {
            credentials: 'include',
          })
          const bookingData = await bookingResponse.json()
          
          if (bookingData.success && bookingData.data) {
            // Use booking total amount (in dollars, convert to cents for display)
            const bookingAmount = bookingData.data.totalAmount || 0
            setAmount(Math.round(bookingAmount * 100)) // Convert to cents for consistency
          } else {
            // Fallback: get amount from payment intent
            const response = await fetch("/api/v1/payments/retrieve-intent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify({ clientSecret }),
            })
            const data = await response.json()
            if (data.success) {
              setAmount(data.amount)
            } else {
              router.push("/dashboard/bookings")
            }
          }
        } catch (error) {
          console.error("Failed to retrieve payment intent:", error)
          router.push("/dashboard/bookings")
        } finally {
          setLoading(false)
        }
      }

      retrieveIntent()
      return
    }

    // If neither bookingId nor clientSecret, redirect
    if (!bookingId && !clientSecret) {
      router.push("/dashboard/bookings")
    }
  }, [clientSecret, bookingId, router])

  const handlePayment = async () => {
    if (!clientSecret || !bookingId) return

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      // In production, you would:
      // 1. Load Stripe.js dynamically
      // 2. Create Stripe instance
      // 3. Call stripe.confirmPayment()
      
      // For now, we'll simulate a payment redirect to a Stripe hosted page
      // In production, integrate properly with Stripe.js
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Redirect to success (in real implementation, Stripe handles this)
      router.push(`/payment-success?bookingId=${bookingId}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment failed")
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading payment page...</p>
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage && !clientSecret) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 max-w-md mx-auto">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
              <p className="text-red-800 font-medium">{errorMessage}</p>
            </div>
            <Link href="/dashboard/bookings">
              <Button variant="outline" className="mt-4">
                Back to Bookings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Invalid payment request</p>
            <Link href="/dashboard/bookings">
              <Button variant="outline" className="mt-4">
                Back to Bookings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WarehouseIcon className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">TSmart Warehouse</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-lg mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Complete Payment</h1>
              <p className="text-muted-foreground">
                Secure payment powered by Stripe
              </p>
            </div>

            {/* Payment Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                {amount && (
                  <CardDescription>
                    Total Amount: <span className="font-semibold text-foreground">{formatCurrency(amount / 100)}</span>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Form Placeholder */}
                <div className="p-6 border rounded-lg bg-muted">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Card Information</label>
                      <div className="mt-2 p-4 border rounded bg-background">
                        <p className="text-sm text-muted-foreground">
                          Stripe payment form will be embedded here
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cardholder Name</label>
                      <input
                        type="text"
                        placeholder="Full name on card"
                        className="w-full mt-2 px-3 py-2 border rounded-md"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-800">{errorMessage}</p>
                  </div>
                )}

                <Button
                  onClick={handlePayment}
                  size="lg"
                  className="w-full h-12 text-base font-semibold"
                  disabled={isProcessing}
                >
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isProcessing ? "Processing..." : "Pay Now"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your payment is secure and encrypted. We never store your full card details.
                </p>
              </CardContent>
            </Card>

            {/* Security Note */}
            <div className="mt-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">🔒 Secure Payment:</span> Your payment information is encrypted and
                processed securely by Stripe. We never store your full card details.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
