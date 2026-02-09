import { Resend } from "resend"
import type { Invoice } from "@/types"

const resendApiKey = process.env.RESEND_API_KEY
// Gönderici: .env'de RESEND_FROM_EMAIL=info@warebnb.co (domain doğrulandıktan sonra)
// Test için: RESEND_FROM_EMAIL=onboarding@resend.dev (Resend’in ücretsiz test adresi)
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"

function invoiceToHtml(invoice: Invoice): string {
  const rows = (invoice.items || [])
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${item.unitPrice}</td><td>${item.total}</td></tr>`
    )
    .join("")
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.id)}</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1>Invoice</h1>
  <p><strong>Invoice #</strong> ${escapeHtml(invoice.id)}</p>
  <p><strong>Customer</strong> ${escapeHtml(invoice.customerName)}</p>
  <p><strong>Due date</strong> ${escapeHtml(invoice.dueDate)}</p>
  <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
    <thead><tr style="border-bottom: 2px solid #333;"><th style="text-align:left;">Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p><strong>Subtotal</strong> ${invoice.subtotal}</p>
  <p><strong>Tax</strong> ${invoice.tax}</p>
  <p><strong>Total</strong> ${invoice.total}</p>
</body>
</html>
  `.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function sendInvoiceEmail(invoice: Invoice, toEmail: string): Promise<{ ok: boolean; error?: string }> {
  if (!resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" }
  }
  const resend = new Resend(resendApiKey)
  const html = invoiceToHtml(invoice)
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject: `Invoice #${invoice.id} - ${invoice.customerName}`,
    html,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
