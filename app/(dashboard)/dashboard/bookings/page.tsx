import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Plus, Calendar, Search } from "@/components/icons"
import { Input } from "@/components/ui/input"

export const metadata = {
  title: "Bookings | T Smart Warehouse",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500",
  CONFIRMED: "bg-accent/10 text-accent",
  IN_PROGRESS: "bg-primary/10 text-primary",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500",
  CANCELLED: "bg-destructive/10 text-destructive",
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user?.id).single()

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("company_id", profile?.company_id || "")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">Manage your warehouse bookings</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/bookings/new">
            <Plus className="w-4 h-4 mr-2" />
            New Booking
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search bookings..." className="pl-9" />
      </div>

      {/* Bookings List */}
      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>{bookings?.length || 0} total bookings</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings && bookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Booking #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Payment</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <Link href={`/dashboard/bookings/${booking.id}`} className="font-medium hover:underline">
                          {booking.booking_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm">{booking.type}</td>
                      <td className="py-3 px-4 text-sm">{new Date(booking.booking_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className={statusColors[booking.status]}>
                          {booking.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">${booking.total_price?.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            booking.payment_status === "PAID"
                              ? "border-green-500 text-green-600"
                              : booking.payment_status === "FAILED"
                                ? "border-destructive text-destructive"
                                : "border-muted-foreground"
                          }
                        >
                          {booking.payment_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/bookings/${booking.id}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-1">No bookings yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first booking to get started</p>
              <Button asChild>
                <Link href="/dashboard/bookings/new">
                  <Plus className="w-4 h-4 mr-2" />
                  New Booking
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
