"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, X, Clock, Calendar, Warehouse, DollarSign } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { useState } from "react"
import type { BookingApproval } from "@/types"

interface BookingApprovalsListProps {
  type?: "pending" | "requested"
}

export function BookingApprovalsList({ type = "pending" }: BookingApprovalsListProps) {
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [selectedApproval, setSelectedApproval] = useState<BookingApproval | null>(null)
  const [responseMessage, setResponseMessage] = useState("")
  const [dialogType, setDialogType] = useState<"approve" | "reject" | null>(null)

  // Fetch approvals
  const { data, isLoading } = useQuery<{ approvals: BookingApproval[]; stats: any }>({
    queryKey: ["booking-approvals", type],
    queryFn: async () => {
      const result = await api.get(`/api/v1/bookings/approvals?type=${type}`, { showToast: false })
      return result.success ? result.data : { approvals: [], stats: {} }
    },
  })

  const approvals = data?.approvals || []
  const stats = data?.stats || {}

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ bookingId, message }: { bookingId: string; message?: string }) => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/approve`,
        { message },
        { showToast: false }
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to approve booking")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-approvals"] })
      setSelectedApproval(null)
      setDialogType(null)
      setResponseMessage("")
      addNotification({
        type: "success",
        message: "Booking approved successfully",
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: "error",
        message: error.message,
        duration: 5000,
      })
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ bookingId, message }: { bookingId: string; message?: string }) => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/reject`,
        { message },
        { showToast: false }
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to reject booking")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-approvals"] })
      setSelectedApproval(null)
      setDialogType(null)
      setResponseMessage("")
      addNotification({
        type: "success",
        message: "Booking rejected",
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: "error",
        message: error.message,
        duration: 5000,
      })
    },
  })

  const handleAction = () => {
    if (!selectedApproval) return
    
    if (dialogType === "approve") {
      approveMutation.mutate({ bookingId: selectedApproval.bookingId, message: responseMessage })
    } else if (dialogType === "reject") {
      rejectMutation.mutate({ bookingId: selectedApproval.bookingId, message: responseMessage })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isPending = type === "pending"

  return (
    <div className="space-y-6">
      {/* Stats */}
      {isPending && stats.pendingCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="font-medium">
                {stats.pendingCount} booking{stats.pendingCount !== 1 ? "s" : ""} waiting for your approval
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approvals List */}
      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {isPending ? "No Pending Approvals" : "No Requested Approvals"}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {isPending
                ? "You don't have any bookings waiting for your approval"
                : "You haven't requested any booking approvals yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Booking #{approval.bookingId.slice(0, 8)}
                    </CardTitle>
                    <CardDescription>
                      {isPending
                        ? `Requested by ${approval.requestedByName}`
                        : `Sent to customer`}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      approval.status === "pending"
                        ? "outline"
                        : approval.status === "approved"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Booking Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                    <span>{approval.warehouseName || "Warehouse"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {approval.booking?.startDate
                        ? new Date(approval.booking.startDate).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>
                      ${approval.booking?.totalAmount?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date(approval.requestedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Request Message */}
                {approval.requestMessage && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground mb-1">Message:</p>
                    <p className="text-sm">{approval.requestMessage}</p>
                  </div>
                )}

                {/* Response Message */}
                {approval.responseMessage && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground mb-1">Response:</p>
                    <p className="text-sm">{approval.responseMessage}</p>
                  </div>
                )}
              </CardContent>
              {isPending && approval.status === "pending" && (
                <CardFooter className="gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setSelectedApproval(approval)
                      setDialogType("approve")
                    }}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedApproval(approval)
                      setDialogType("reject")
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={!!dialogType} onOpenChange={() => {
        setDialogType(null)
        setSelectedApproval(null)
        setResponseMessage("")
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "approve" ? "Approve Booking" : "Reject Booking"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "approve"
                ? "Confirm that you approve this booking made on your behalf."
                : "Reject this booking and cancel the reservation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                placeholder={
                  dialogType === "approve"
                    ? "Add a note for the person who made this booking..."
                    : "Explain why you're rejecting this booking..."
                }
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button
              variant={dialogType === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {dialogType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
