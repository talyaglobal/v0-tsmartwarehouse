"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Package, Building2, Eye, Loader2 } from "@/components/icons"
import { formatCurrency, formatDate, formatNumber, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking } from "@/types"

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/bookings')
      if (response.ok) {
        const data = await response.json()
        setBookings(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeBookings = bookings.filter((b) => b.status === "active")
  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const totalValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0)
  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Manage all warehouse bookings">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{bookings.length}</div>
            <p className="text-xs text-muted-foreground">Total Bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeBookings.length}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingBookings.length}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>View and manage customer bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{booking.customerName}</p>
                      <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {booking.type === "pallet" ? (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getBookingTypeLabel(booking.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {booking.type === "pallet"
                      ? `${booking.palletCount} pallets`
                      : `${formatNumber(booking.areaSqFt || 0)} sq ft (L3)`}
                  </TableCell>
                  <TableCell>{formatDate(booking.startDate)}</TableCell>
                  <TableCell>{formatCurrency(booking.totalAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
