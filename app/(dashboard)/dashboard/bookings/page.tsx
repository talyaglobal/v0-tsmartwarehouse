"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Package, Building2, Eye, Loader2 } from "@/components/icons"
import { formatCurrency, formatDate, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking } from "@/types"
import { api } from "@/lib/api/client"

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const result = await api.get('/api/v1/bookings', { showToast: false })
      if (result.success) {
        setBookings(result.data || [])
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
  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Manage your warehouse storage bookings">
        <Link href="/dashboard/bookings/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>View and manage all your warehouse bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.id}</TableCell>
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
                      : `${booking.areaSqFt?.toLocaleString()} sq ft`}
                  </TableCell>
                  <TableCell>{formatDate(booking.startDate)}</TableCell>
                  <TableCell>{formatCurrency(booking.totalAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/bookings/${booking.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
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
