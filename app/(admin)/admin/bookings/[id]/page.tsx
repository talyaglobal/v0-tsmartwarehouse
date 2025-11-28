"use client"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { mockBookings, mockCustomers, mockWarehouses, mockStorageUnits, mockInvoices } from "@/lib/mock-data"
import { formatCurrency, formatDate, getInitials } from "@/lib/utils/format"
import { ArrowLeft, Calendar, Package, Building2, CreditCard, FileText, Clock, Edit } from "lucide-react"
import Link from "next/link"

export default function BookingDetailPage() {
  const params = useParams()

  const booking = mockBookings.find((b) => b.id === params.id)
  const customer = booking?.customer_id ? mockCustomers.find((c) => c.id === booking.customer_id) : null
  const warehouse = booking?.warehouse_id ? mockWarehouses.find((w) => w.id === booking.warehouse_id) : null
  const storageUnit = booking?.storage_unit_id ? mockStorageUnits.find((u) => u.id === booking.storage_unit_id) : null
  const relatedInvoices = mockInvoices.filter((i) => i.booking_id === booking?.id)

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Booking not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={booking.booking_number} description={`${booking.service_type.replace("_", " ")} booking`}>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Booking Overview</CardTitle>
                  <CardDescription>Created {formatDate(booking.created_at)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge type="booking" status={booking.status} />
                  <StatusBadge type="payment" status={booking.payment_status} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formatDate(booking.start_date)}</p>
                  </div>
                </div>
                {booking.end_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p className="font-medium">{formatDate(booking.end_date)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Items</p>
                    <p className="font-medium">
                      {booking.actual_items || booking.estimated_items} items
                      {booking.actual_items && (
                        <span className="text-muted-foreground text-sm"> (Est: {booking.estimated_items})</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Service Type</p>
                    <p className="font-medium capitalize">{booking.service_type.replace("_", " ")}</p>
                  </div>
                </div>
              </div>

              {booking.special_instructions && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Special Instructions</h4>
                    <p className="text-muted-foreground">{booking.special_instructions}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="text-xl font-bold">{formatCurrency(booking.total_amount)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Deposit</span>
                  <span className="font-medium">{formatCurrency(booking.deposit_amount)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-medium">{formatCurrency(booking.total_amount - booking.deposit_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Invoices</CardTitle>
              <Button variant="outline" size="sm">
                Create Invoice
              </Button>
            </CardHeader>
            <CardContent>
              {relatedInvoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No invoices yet</p>
              ) : (
                <div className="space-y-3">
                  {relatedInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Link
                            href={`/admin/invoices/${invoice.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {invoice.invoice_number}
                          </Link>
                          <p className="text-xs text-muted-foreground">Due: {formatDate(invoice.due_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
                        <StatusBadge type="payment" status={invoice.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          {customer && (
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar>
                    <AvatarFallback>{getInitials(customer.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{customer.full_name}</p>
                    <p className="text-sm text-muted-foreground">{customer.company_name}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{customer.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tier</span>
                    <StatusBadge type="membership" status={customer.membership_tier} />
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4 bg-transparent" asChild>
                  <Link href={`/admin/customers/${customer.id}`}>View Profile</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {warehouse && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Warehouse</p>
                  <p className="font-medium">{warehouse.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {warehouse.address.city}, {warehouse.address.state}
                  </p>
                </div>
              )}
              {storageUnit && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Storage Unit</p>
                  <p className="font-medium">{storageUnit.unit_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Zone {storageUnit.zone}, Aisle {storageUnit.aisle}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <FileText className="mr-2 h-4 w-4" />
                Generate Invoice
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Clock className="mr-2 h-4 w-4" />
                Extend Booking
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
