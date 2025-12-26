"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Package, Building2, Eye, Loader2, Edit, Trash } from "@/components/icons"
import { formatCurrency, formatDate, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking, BookingStatus } from "@/types"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"

const BOOKINGS_TAB_STORAGE_KEY = 'bookings-page-active-tab'

type BookingsTab = 'my-bookings' | 'warehouse-bookings'

export default function BookingsPage() {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ bookingId: string; newStatus: BookingStatus } | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const { user, isLoading: userLoading } = useUser()
  const queryClient = useQueryClient()
  
  // Get active tab from localStorage, default to 'my-bookings'
  const [activeTab, setActiveTab] = useState<BookingsTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(BOOKINGS_TAB_STORAGE_KEY) as BookingsTab | null
      return saved && (saved === 'my-bookings' || saved === 'warehouse-bookings') ? saved : 'my-bookings'
    }
    return 'my-bookings'
  })

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BOOKINGS_TAB_STORAGE_KEY, activeTab)
    }
  }, [activeTab])

  // Get user's company ID
  const { data: userCompanyId } = useQuery({
    queryKey: ['user-company-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      return profile?.company_id || null
    },
    enabled: !!user?.id,
  })

  // React Query: Fetch my bookings (bookings I made)
  const {
    data: myBookings = [],
    isLoading: myBookingsLoading,
    error: myBookingsError,
  } = useQuery({
    queryKey: ['bookings', 'my-bookings', user?.id],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<Booking[]>(`/api/v1/bookings?customerId=${user.id}`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading && activeTab === 'my-bookings',
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // React Query: Fetch warehouse bookings (bookings to my company's warehouses)
  const {
    data: warehouseBookings = [],
    isLoading: warehouseBookingsLoading,
    error: warehouseBookingsError,
  } = useQuery({
    queryKey: ['bookings', 'warehouse-bookings', userCompanyId],
    queryFn: async () => {
      if (!userCompanyId) return []
      const result = await api.get<Booking[]>(`/api/v1/bookings?warehouseCompanyId=${userCompanyId}`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!userCompanyId && activeTab === 'warehouse-bookings',
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Use appropriate data based on active tab
  const bookings = activeTab === 'my-bookings' ? myBookings : warehouseBookings
  const loading = activeTab === 'my-bookings' ? myBookingsLoading : warehouseBookingsLoading
  const error = activeTab === 'my-bookings' ? myBookingsError : warehouseBookingsError

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
      return result.data
    },
    onMutate: async ({ bookingId, newStatus }) => {
      // Cancel any outgoing refetches for both queries
      await queryClient.cancelQueries({ queryKey: ['bookings', 'my-bookings', user?.id] })
      await queryClient.cancelQueries({ queryKey: ['bookings', 'warehouse-bookings', userCompanyId] })

      // Snapshot the previous values
      const previousMyBookings = queryClient.getQueryData<Booking[]>(['bookings', 'my-bookings', user?.id])
      const previousWarehouseBookings = queryClient.getQueryData<Booking[]>(['bookings', 'warehouse-bookings', userCompanyId])

      // Optimistically update both queries
      queryClient.setQueryData<Booking[]>(['bookings', 'my-bookings', user?.id], (old = []) =>
        old.map(booking =>
          booking.id === bookingId ? { ...booking, status: newStatus } : booking
        )
      )
      queryClient.setQueryData<Booking[]>(['bookings', 'warehouse-bookings', userCompanyId], (old = []) =>
        old.map(booking =>
          booking.id === bookingId ? { ...booking, status: newStatus } : booking
        )
      )

      // Return a context object with the snapshotted values
      return { previousMyBookings, previousWarehouseBookings }
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMyBookings) {
        queryClient.setQueryData(['bookings', 'my-bookings', user?.id], context.previousMyBookings)
      }
      if (context?.previousWarehouseBookings) {
        queryClient.setQueryData(['bookings', 'warehouse-bookings', userCompanyId], context.previousWarehouseBookings)
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my-bookings', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['bookings', 'warehouse-bookings', userCompanyId] })
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
      // Remove from cache
      queryClient.setQueryData<Booking[]>(['bookings', user?.id], (old = []) =>
        old.filter(b => b.id !== bookingId)
      )
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

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
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
          <CardTitle>Bookings</CardTitle>
          <CardDescription>
            {activeTab === 'my-bookings' 
              ? 'View and manage bookings you have created' 
              : 'View and manage bookings to your company warehouses'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BookingsTab)}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="my-bookings">My Bookings</TabsTrigger>
              <TabsTrigger value="warehouse-bookings">Warehouse Bookings</TabsTrigger>
            </TabsList>
            <TabsContent value="my-bookings" className="mt-0">
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
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                    <div className="relative status-dropdown-container">
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
                      {openStatusDropdown === booking.id && dropdownPosition && (
                        <>
                          <div 
                            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-[180px]"
                            style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                          >
                            <div className="py-1">
                              {['pending', 'confirmed', 'active', 'completed', 'cancelled'].map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => handleStatusSelect(booking.id, status as BookingStatus)}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={status === booking.status}
                                >
                                  <StatusBadge status={status as BookingStatus} />
                                  {status === booking.status && <span className="text-xs text-muted-foreground">(current)</span>}
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
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/bookings/${booking.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
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
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
            </TabsContent>
            <TabsContent value="warehouse-bookings" className="mt-0">
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
              {warehouseBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No bookings found for your company warehouses
                  </TableCell>
                </TableRow>
              ) : (
                warehouseBookings.map((booking) => (
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
                    <div className="relative status-dropdown-container">
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
                      {openStatusDropdown === booking.id && dropdownPosition && (
                        <>
                          <div 
                            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-[180px]"
                            style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                          >
                            <div className="py-1">
                              {['pending', 'confirmed', 'active', 'completed', 'cancelled'].map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => handleStatusSelect(booking.id, status as BookingStatus)}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={status === booking.status}
                                >
                                  <StatusBadge status={status as BookingStatus} />
                                  {status === booking.status && <span className="text-xs text-muted-foreground">(current)</span>}
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
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/bookings/${booking.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
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
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
