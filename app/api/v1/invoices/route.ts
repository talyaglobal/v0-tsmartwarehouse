import { type NextRequest, NextResponse } from "next/server"
import { mockInvoices } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get("customerId")
  const status = searchParams.get("status")

  let invoices = [...mockInvoices]

  if (customerId) {
    invoices = invoices.filter((i) => i.customerId === customerId)
  }
  if (status) {
    invoices = invoices.filter((i) => i.status === status)
  }

  return NextResponse.json({
    success: true,
    data: invoices,
    total: invoices.length,
  })
}
