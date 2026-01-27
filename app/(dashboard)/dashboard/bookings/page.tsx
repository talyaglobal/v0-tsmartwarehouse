"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Package, Building2, Eye, Loader2, Edit, Trash, XCircle, DollarSign } from "@/components/icons"
import { formatCurrency, formatDate, getBookingTypeLabel, formatNumber } from "@/lib/utils/format"
import type { Booking, BookingStatus } from "@/types"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { TimeSlotSelectionModal } from "@/components/bookings/time-slot-selection-modal"
import { AcceptProposedTimeModal } from "@/components/bookings/accept-proposed-time-modal"
import { useRouter } from "next/navigation"
import { RootTestDataIndicator } from "@/components/ui/root-test-data-badge"
import { getRootUserIds, isTestDataSync } from "@/lib/utils/test-data"

export default function BookingsPage() {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ bookingId: string; newStatus: BookingStatus } | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedBookingForTimeSlot, setSelectedBookingForTimeSlot] = useState<Booking | null>(null)
  const [selectedBookingForAccept, setSelectedBookingForAccept] = useState<Booking | null>(null)
  const { user, isLoading: userLoading } = useUser()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [rootUserIds, setRootUserIds] = useState<string[]>([])

  // Fetch root user IDs for test data detection
  useEffect(() => {
    getRootUserIds().then(setRootUserIds)
  }, [])

  // Get user's role and company ID
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .maybeSingle()
      return profile
    },
    enabled: !!user?.id,
  })

  const isCustomer = userProfile?.role === 'warehouse_client'
  const userCompanyId = userProfile?.company_id

  // Fetch bookings based on user role
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useQuery({
    queryKey: ['bookings', user?.id, userCompanyId, isCustomer],
    queryFn: async () => {
      if (!user) return []

      // If customer role, fetch only their own bookings (all statuses including pre_order and payment_pending)
      if (isCustomer) {
        const result = await api.get<Booking[]>(`/api/v1/bookings?customerId=${user.id}`, { showToast: false })
        return result.success ? (result.data || []) : []
      }

      // For company roles, fetch all bookings to company warehouses (from ANY customer, all statuses)
      if (userCompanyId) {
        const result = await api.get<Booking[]>(`/api/v1/bookings?warehouseCompanyId=${userCompanyId}`, { showToast: false })
        return result.success ? (result.data || []) : []
      }

      return []
    },
    enabled: !!user && !userLoading && (isCustomer || !!userCompanyId),
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  })

  // React Query: Update booking status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ bookingId, newStatus }: { bookingId: string; newStatus: BookingStatus }) => {
      const result = await api.patch(`/api/v1/bookings/${bookingId}`, {
        status: newStatus,
      }, {
        successMessage: 'Booking status updated successfully',
        errorMessage: 'Failed to update booking status',
      })
      if (!result.success) {
        throw new Error(result.error || 'Failed to update status')
      }
      return { bookingId, newStatus, data: result.data }
    },
    onSuccess: ({ bookingId, newStatus }) => {
      // Immediately update the cache with new status
      queryClient.setQueryData<Booking[]>(['bookings', user?.id, userCompanyId, isCustomer], (old = []) =>
        old.map(booking =>
          booking.id === bookingId ? { ...booking, status: newStatus } : booking
        )
      )

      // Close the dropdown
      setOpenStatusDropdown(null)
    },
    onError: (error) => {
      console.error('Status update error:', error)
      // Refetch to get the correct state from server
      queryClient.invalidateQueries({ queryKey: ['bookings', user?.id, userCompanyId, isCustomer] })
    },
  })

  // React Query: Delete booking mutation
  const deleteMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const result = await api.delete(`/api/v1/bookings/${bookingId}`, {
        successMessage: 'Booking deleted successfully',
        errorMessage: 'Failed to delete booking',
      })
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete booking')
      }
      return bookingId
    },
    onSuccess: (bookingId) => {
      // Immediately remove from cache
      queryClient.setQueryData<Booking[]>(['bookings', user?.id, userCompanyId, isCustomer], (old = []) =>
        old ? old.filter(b => b.id !== bookingId) : []
      )
    },
    onError: (error) => {
      console.error('Delete error:', error)
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['bookings', user?.id, userCompanyId, isCustomer] })
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openStatusDropdown && !(event.target as Element).closest('.status-dropdown-container')) {
        setOpenStatusDropdown(null)
        setDropdownPosition(null)
      }
    }
    if (openStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openStatusDropdown])

  const handleStatusSelect = (bookingId: string, newStatus: BookingStatus) => {
    setOpenStatusDropdown(null)
    setDropdownPosition(null)
    setPendingStatusChange({ bookingId, newStatus })
  }

  const confirmStatusChange = () => {
    if (!pendingStatusChange) return

    const { bookingId, newStatus } = pendingStatusChange
    setPendingStatusChange(null)
    statusMutation.mutate({ bookingId, newStatus })
  }

  const handleDelete = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      return
    }

    setDeletingId(bookingId)
    deleteMutation.mutate(bookingId, {
      onSettled: () => {
        setDeletingId(null)
      },
    })
  }

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return
    }

    statusMutation.mutate({ bookingId, newStatus: 'cancelled' })
  }

  if (bookingsLoading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (bookingsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Failed to load bookings. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Status Change</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to change the status to <strong>{pendingStatusChange.newStatus}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setPendingStatusChange(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmStatusChange}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Yes, Change Status'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Bookings"
        description={isCustomer ? "View and manage your bookings" : "Manage bookings to your company warehouses"}
      >
        {isCustomer && (
          <Link href="/dashboard/bookings/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Booking
            </Button>
          </Link>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{isCustomer ? "My Bookings" : "Company Warehouse Bookings"}</CardTitle>
          <CardDescription>
            {isCustomer
              ? "View and manage bookings you have created"
              : "View and manage all bookings to your company warehouses"
            }
          </CardDescription>
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
                    {isCustomer
                      ? "No bookings found. Create your first booking to get started!"
                      : "No bookings found for your company warehouses"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => {
                  // Normalize status: handle different formats like "Payment Pending", "payment_pending", etc.
                  const normalizedStatus = booking.status?.toLowerCase()?.replace(/\s+/g, '_')?.replace(/-/g, '_')
                  const isPaymentPending = normalizedStatus === 'payment_pending' || booking.status === 'payment_pending'
                  
                  return (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {booking.id}
                      {isTestDataSync(booking.customerId, rootUserIds) && (
                        <RootTestDataIndicator />
                      )}
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
                      : `${formatNumber(booking.areaSqFt)} sq ft`}
                  </TableCell>
                  <TableCell>{formatDate(booking.startDate)}</TableCell>
                  <TableCell>{formatCurrency(booking.totalAmount)}</TableCell>
                  <TableCell>
                    <div className="relative status-dropdown-container">
                      {isCustomer ? (
                        // Customer can only view status, not change it
                        <StatusBadge status={booking.status} />
                      ) : (
                        // Company staff can change status
                        <button
                          type="button"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPosition({ top: rect.bottom + 4, left: rect.left })
                            setOpenStatusDropdown(openStatusDropdown === booking.id ? null : booking.id)
                          }}
                          disabled={statusMutation.isPending}
                          className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <StatusBadge status={booking.status} />
                        </button>
                      )}
                      {openStatusDropdown === booking.id && dropdownPosition && (
                        <>
                          <div
                            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-[180px]"
                            style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                          >
                            <div className="py-1">
                              {['pending', 'payment_pending', 'confirmed', 'active', 'completed', 'cancelled'].map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => handleStatusSelect(booking.id, status as BookingStatus)}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={status === booking.status || status === 'payment_pending'}
                                  title={status === 'payment_pending' ? 'Payment pending status is set automatically by the system' : ''}
                                >
                                  <StatusBadge status={status as BookingStatus} />
                                  {status === booking.status && <span className="text-xs text-muted-foreground">(current)</span>}
                                  {status === 'payment_pending' && status !== booking.status && <span className="text-xs text-muted-foreground">(auto)</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Backdrop to close dropdown when clicking outside */}
                          <div
                            className="fixed inset-0 z-[9998]"
                            onClick={() => {
                              setOpenStatusDropdown(null)
                              setDropdownPosition(null)
                            }}
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <Link href={`/dashboard/bookings/${booking.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {isCustomer ? (
                        <>
                          {/* Time Slot Actions for awaiting_time_slot or pending status with proposed time */}
                          {(booking.status === 'awaiting_time_slot' || booking.status === 'pending') && booking.proposedStartDate && booking.proposedStartTime && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setSelectedBookingForAccept(booking)}
                                title="Accept proposed time"
                              >
                                Accept Time
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedBookingForTimeSlot(booking)}
                                title="Select different time"
                              >
                                Select Time
                              </Button>
                            </>
                          )}
                          {/* Time Slot Selection for awaiting_time_slot without proposed time */}
                          {booking.status === 'awaiting_time_slot' && !booking.proposedStartDate && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setSelectedBookingForTimeSlot(booking)}
                              title="Select time slot"
                            >
                              Select Time Slot
                            </Button>
                          )}
                          {/* Pay Now button for payment_pending status */}
                          {isPaymentPending && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => router.push(`/payment?bookingId=${booking.id}`)}
                              title="Pay now"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pay Now
                            </Button>
                          )}
                          {/* Cancel button */}
                          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancel booking"
                              onClick={() => handleCancel(booking.id)}
                              disabled={statusMutation.isPending}
                            >
                              {statusMutation.isPending && statusMutation.variables?.bookingId === booking.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4 text-orange-500" />
                              )}
                            </Button>
                          )}
                        </>
                      ) : (
                        // Company staff can edit and delete
                        <>
                          <Link href={`/dashboard/bookings/${booking.id}/edit`}>
                            <Button variant="ghost" size="sm" title="Edit booking">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete booking"
                            onClick={() => handleDelete(booking.id)}
                            disabled={deletingId === booking.id || deleteMutation.isPending}
                          >
                            {deletingId === booking.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Time Slot Selection Modal */}
      {selectedBookingForTimeSlot && (
        <TimeSlotSelectionModal
          booking={selectedBookingForTimeSlot}
          open={!!selectedBookingForTimeSlot}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedBookingForTimeSlot(null)
              queryClient.invalidateQueries({ queryKey: ['bookings', user?.id, userCompanyId, isCustomer] })
            }
          }}
        />
      )}

      {/* Accept Proposed Time Modal */}
      {selectedBookingForAccept && (
        <AcceptProposedTimeModal
          booking={selectedBookingForAccept}
          open={!!selectedBookingForAccept}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedBookingForAccept(null)
              queryClient.invalidateQueries({ queryKey: ['bookings', user?.id, userCompanyId, isCustomer] })
            }
          }}
        />
      )}
    </div>
  )
}
