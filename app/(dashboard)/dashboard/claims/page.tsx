"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Plus, Clock, CheckCircle, FileText, Loader2, Eye, Edit, Trash } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Claim, ClaimStatus } from "@/types"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"

export default function ClaimsPage() {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ claimId: string; newStatus: ClaimStatus } | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const { user, isLoading: userLoading } = useUser()
  const queryClient = useQueryClient()

  // React Query: Fetch claims
  const {
    data: claims = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['claims', user?.id],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<Claim[]>('/api/v1/claims', { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  })

  // React Query: Update claim status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ claimId, newStatus }: { claimId: string; newStatus: ClaimStatus }) => {
      const result = await api.patch(`/api/v1/claims/${claimId}`, {
        status: newStatus,
      }, {
        successMessage: 'Claim status updated successfully',
        errorMessage: 'Failed to update claim status',
      })
      if (!result.success) {
        throw new Error(result.error || 'Failed to update status')
      }
      return { claimId, newStatus, data: result.data }
    },
    onSuccess: ({ claimId, newStatus }) => {
      // Immediately update the cache with new status
      queryClient.setQueryData<Claim[]>(['claims', user?.id], (old = []) =>
        old.map(claim =>
          claim.id === claimId ? { ...claim, status: newStatus } : claim
        )
      )

      // Close the dropdown
      setOpenStatusDropdown(null)
      setDropdownPosition(null)
    },
    onError: (error) => {
      console.error('Claim status update error:', error)
      // Refetch to get the correct state from server
      queryClient.invalidateQueries({ queryKey: ['claims', user?.id] })
    },
  })

  // React Query: Delete claim mutation
  const deleteMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const result = await api.delete(`/api/v1/claims/${claimId}`, {
        successMessage: 'Claim deleted successfully',
        errorMessage: 'Failed to delete claim',
      })
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete claim')
      }
      return claimId
    },
    onSuccess: (claimId) => {
      // Immediately remove from cache
      queryClient.setQueryData<Claim[]>(['claims', user?.id], (old = []) =>
        old ? old.filter(c => c.id !== claimId) : []
      )
    },
    onError: (error) => {
      console.error('Claim delete error:', error)
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['claims', user?.id] })
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

  const handleStatusSelect = (claimId: string, newStatus: ClaimStatus) => {
    setOpenStatusDropdown(null)
    setDropdownPosition(null)
    setPendingStatusChange({ claimId, newStatus })
  }

  const confirmStatusChange = () => {
    if (!pendingStatusChange) return

    const { claimId, newStatus } = pendingStatusChange
    setPendingStatusChange(null)
    statusMutation.mutate({ claimId, newStatus })
  }

  const handleDelete = async (claimId: string) => {
    if (!confirm('Are you sure you want to delete this claim? This action cannot be undone.')) {
      return
    }

    setDeletingId(claimId)
    deleteMutation.mutate(claimId, {
      onSettled: () => {
        setDeletingId(null)
      },
    })
  }

  const customerClaims = claims
  const openClaims = customerClaims.filter((c) => c.status === 'submitted' || c.status === 'under-review')
  const approvedClaims = customerClaims.filter((c) => c.status === 'approved')
  const approvedTotal = approvedClaims.reduce((sum, c) => sum + c.amount, 0)

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
        <p className="text-destructive">Failed to load claims. Please try again.</p>
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
        title="Claims"
        description="Submit and track damage or loss claims"
      >
        <Link href="/dashboard/claims/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Submit Claim
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Claims</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openClaims.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedClaims.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(approvedTotal)} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerClaims.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Claim History</CardTitle>
          <CardDescription>View all your submitted claims</CardDescription>
        </CardHeader>
        <CardContent>
          {customerClaims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">#{claim.id.substring(0, 8)}</TableCell>
                    <TableCell className="capitalize">{claim.type}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{claim.description}</TableCell>
                    <TableCell>{formatCurrency(claim.amount)}</TableCell>
                    <TableCell>
                      <div className="relative status-dropdown-container">
                        <button
                          type="button"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPosition({ top: rect.bottom + 4, left: rect.left })
                            setOpenStatusDropdown(openStatusDropdown === claim.id ? null : claim.id)
                          }}
                          disabled={statusMutation.isPending}
                          className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <StatusBadge status={claim.status} />
                        </button>
                        {openStatusDropdown === claim.id && dropdownPosition && (
                          <>
                            <div 
                              className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-[180px]"
                              style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                            >
                              <div className="py-1">
                                {['submitted', 'under-review', 'approved', 'rejected', 'paid'].map((status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => handleStatusSelect(claim.id, status as ClaimStatus)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={status === claim.status}
                                  >
                                    <StatusBadge status={status as ClaimStatus} />
                                    {status === claim.status && <span className="text-xs text-muted-foreground">(current)</span>}
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
                    <TableCell>{formatDate(claim.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/claims/${claim.id}`}>
                          <Button variant="ghost" size="sm" title="View details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/dashboard/claims/${claim.id}/edit`}>
                          <Button variant="ghost" size="sm" title="Edit claim">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete claim"
                          onClick={() => handleDelete(claim.id)}
                          disabled={deletingId === claim.id || deleteMutation.isPending}
                        >
                          {deletingId === claim.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No claims yet</h3>
              <p className="text-muted-foreground mb-4">
                Submit a claim if you experience any issues with your stored goods.
              </p>
              <Link href="/dashboard/claims/new">
                <Button>Submit Your First Claim</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
