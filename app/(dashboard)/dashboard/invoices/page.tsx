import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Download } from "@/components/icons"

export const metadata = {
  title: "Invoices | T Smart Warehouse",
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user?.id).single()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, bookings(booking_number)")
    .eq("company_id", profile?.company_id || "")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">View and download your invoices</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>{invoices?.length || 0} total invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Booking</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Issue Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Due Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{invoice.invoice_number}</td>
                      <td className="py-3 px-4 text-sm">{invoice.bookings?.booking_number}</td>
                      <td className="py-3 px-4 text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-sm">{new Date(invoice.due_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-sm">${invoice.total?.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={invoice.paid_at ? "default" : "secondary"}>
                          {invoice.paid_at ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-1">No invoices yet</h3>
              <p className="text-sm text-muted-foreground">Invoices will appear here after bookings are confirmed</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
