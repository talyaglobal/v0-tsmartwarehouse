import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Get company ID
    const companyId = await getUserCompanyId(user.id)
    if (!companyId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Company not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get user message
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Message is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check Groq API key
    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      console.error("GROQ_API_KEY is not set in environment variables")
      const errorData: ErrorResponse = {
        success: false,
        error: "AI service configuration error",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    // Fetch company data from Supabase
    const supabase = createServerSupabaseClient()

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name, description")
      .eq("id", companyId)
      .eq("status", true)
      .single()

    if (companyError) {
      console.error("Error fetching company:", companyError)
    }

    // Get recent bookings
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, booking_status, quantity, created_at, customer_id")
      .eq("company_id", companyId)
      .eq("status", true)
      .order("created_at", { ascending: false })
      .limit(10)

    // Get recent orders
    const { data: orders } = await supabase
      .from("service_orders")
      .select("id, order_status, total_amount, created_at")
      .eq("company_id", companyId)
      .eq("status", true)
      .order("created_at", { ascending: false })
      .limit(10)

    // Get inventory items
    const { data: inventory } = await supabase
      .from("inventory_items")
      .select("id, item_name, quantity, location")
      .eq("company_id", companyId)
      .eq("status", true)
      .order("created_at", { ascending: false })
      .limit(10)

    // Get invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_status, total_amount, due_date")
      .eq("company_id", companyId)
      .eq("status", true)
      .order("created_at", { ascending: false })
      .limit(10)

    // Prepare context for AI
    const bookingsText = bookings && bookings.length > 0
      ? bookings.map(b => `- Rezervasyon #${b.id}: Durum: ${b.booking_status}, Miktar: ${b.quantity}, Tarih: ${new Date(b.created_at).toLocaleDateString("tr-TR")}`).join("\n")
      : "Rezervasyon bulunmamaktadır"

    const ordersText = orders && orders.length > 0
      ? orders.map(o => `- Sipariş #${o.id}: Durum: ${o.order_status}, Tutar: ${o.total_amount ? `$${o.total_amount}` : "N/A"}, Tarih: ${new Date(o.created_at).toLocaleDateString("tr-TR")}`).join("\n")
      : "Sipariş bulunmamaktadır"

    const inventoryText = inventory && inventory.length > 0
      ? inventory.map(i => `- ${i.item_name || "İsimsiz"}: Miktar: ${i.quantity || 0}, Konum: ${i.location || "Belirtilmemiş"}`).join("\n")
      : "Envanter öğesi bulunmamaktadır"

    const invoicesText = invoices && invoices.length > 0
      ? invoices.map(inv => `- Fatura #${inv.id}: Durum: ${inv.invoice_status}, Tutar: ${inv.total_amount ? `$${inv.total_amount}` : "N/A"}, Vade: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("tr-TR") : "N/A"}`).join("\n")
      : "Fatura bulunmamaktadır"

    const context = `
Şirket Bilgileri:
- İsim: ${company?.name || "N/A"}
- Açıklama: ${company?.description || "N/A"}

Son Rezervasyonlar (${bookings?.length || 0}):
${bookingsText}

Son Siparişler (${orders?.length || 0}):
${ordersText}

Envanter Öğeleri (${inventory?.length || 0}):
${inventoryText}

Son Faturalar (${invoices?.length || 0}):
${invoicesText}
`

    // Call Groq API
    const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant"
    
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          {
            role: "system",
            content: `Sen bir depo yönetim sistemi için yardımcı bir AI asistanısın. 
Şirket verilerine erişimin var: rezervasyonlar, siparişler, envanter ve faturalar.
Soruları verilen bağlamda yanıtla. Kısa ve yardımcı ol. 
Bilgin yoksa nazikçe söyle. Türkçe yanıt ver.`
          },
          {
            role: "user",
            content: `Bağlam:\n${context}\n\nKullanıcı Sorusu: ${message.trim()}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error("Groq API error:", groqResponse.status, errorText)
      const errorData: ErrorResponse = {
        success: false,
        error: "AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const data = await groqResponse.json()
    const aiResponse = data.choices?.[0]?.message?.content || "Üzgünüm, bir yanıt oluşturamadım."

    const responseData: ApiResponse = {
      success: true,
      data: {
        response: aiResponse,
      },
      message: "AI yanıtı başarıyla oluşturuldu",
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("AI chat error:", error)
    const errorResponse = handleApiError(error, { path: "/api/v1/ai/chat", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

