import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar, FileText, Package, ArrowRight, Clock } from "@/components/icons"

export const metadata = {
  title: "Dashboard | T Smart Warehouse",
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(*), memberships:companies(memberships(*))")
    .eq("id", user?.id)
    .single()

  const companyId = profile?.company_id

  // Get booking stats
  const { count: totalBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId || "")

  const { count: activeBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId || "")
    .in("status", ["CONFIRMED", "IN_PROGRESS"])

  const { count: pendingInvoices } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId || "")
    .is("paid_at", null)

  // Get recent bookings
  const { data: recentBookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("company_id", companyId || "")
    .order("created_at", { ascending: false })
    .limit(5)

  const membership = profile?.companies?.memberships?.[0]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {profile?.full_name || "User"}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/bookings/new">
            <Calendar className="w-4 h-4 mr-2" />
            New Booking
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bookings</CardDescription>
            <CardTitle className="text-3xl">{totalBookings || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Bookings</CardDescription>
            <CardTitle className="text-3xl">{activeBookings || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Invoices</CardDescription>
            <CardTitle className="text-3xl">{pendingInvoices || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available Credit</CardDescription>
            <CardTitle className="text-3xl">
              ${membership ? (membership.credit_limit - membership.credit_used).toFixed(0) : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">of ${membership?.credit_limit?.toFixed(0) || "0"} limit</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Bookings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/dashboard/bookings/new"
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Create Booking</p>
                  <p className="text-xs text-muted-foreground">Book warehouse space</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/invoices"
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">View Invoices</p>
                  <p className="text-xs text-muted-foreground">Manage payments</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Your latest bookings</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/bookings">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentBookings && recentBookings.length > 0 ? (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/dashboard/bookings/${booking.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{booking.booking_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(booking.booking_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        booking.status === "CONFIRMED"
                          ? "bg-accent/10 text-accent"
                          : booking.status === "COMPLETED"
                            ? "bg-primary/10 text-primary"
                            : booking.status === "CANCELLED"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No bookings yet</p>
                <Button className="mt-4" size="sm" asChild>
                  <Link href="/dashboard/bookings/new">Create your first booking</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
