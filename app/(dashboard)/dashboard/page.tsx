import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Package, DollarSign, FileText, ArrowRight, Building2 } from "@/components/icons"
import { mockBookings, mockInvoices } from "@/lib/mock-data"
import { formatCurrency, formatDate } from "@/lib/utils/format"

export default function CustomerDashboardPage() {
  const activeBookings = mockBookings.filter((b) => b.status === "active" || b.status === "confirmed")
  const pendingInvoices = mockInvoices.filter((i) => i.status === "pending")
  const totalPallets = activeBookings.reduce((sum, b) => sum + (b.palletCount || 0), 0)
  const totalAreaRented = activeBookings.reduce((sum, b) => sum + (b.areaSqFt || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Welcome back, Sarah. Here's an overview of your warehouse activity.">
        <Link href="/dashboard/bookings/new">
          <Button>New Booking</Button>
        </Link>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Bookings"
          value={activeBookings.length}
          icon={Package}
          trend={{ value: 12, isPositive: true }}
          subtitle="from last month"
        />
        <StatCard title="Pallets Stored" value={totalPallets} icon={Building2} subtitle="across all bookings" />
        <StatCard
          title="Pending Invoices"
          value={pendingInvoices.length}
          icon={FileText}
          subtitle={formatCurrency(pendingInvoices.reduce((sum, i) => sum + i.total, 0))}
        />
        <StatCard
          title="Membership Credits"
          value={formatCurrency(2500)}
          icon={DollarSign}
          trend={{ value: 5, isPositive: true }}
          subtitle="Gold tier benefits"
        />
      </div>

      {/* Recent Bookings & Invoices */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Your latest warehouse bookings</CardDescription>
            </div>
            <Link href="/dashboard/bookings">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      {booking.type === "pallet" ? (
                        <Package className="h-5 w-5 text-primary" />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {booking.type === "pallet"
                          ? `${booking.palletCount} Pallets`
                          : `${booking.areaSqFt?.toLocaleString()} sq ft Area`}
                      </p>
                      <p className="text-sm text-muted-foreground">{formatDate(booking.startDate)}</p>
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Your billing history</CardDescription>
            </div>
            <Link href="/dashboard/invoices">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockInvoices.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Invoice #{invoice.id}</p>
                      <p className="text-sm text-muted-foreground">Due {formatDate(invoice.dueDate)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(invoice.total)}</p>
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Membership Card */}
      <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <Badge variant="secondary" className="mb-2">
              Gold Member
            </Badge>
            <h3 className="text-xl font-bold">10% Discount on All Services</h3>
            <p className="text-amber-100 mt-1">You have {formatCurrency(2500)} in loyalty credits available</p>
          </div>
          <Link href="/dashboard/membership">
            <Button variant="secondary">View Benefits</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
