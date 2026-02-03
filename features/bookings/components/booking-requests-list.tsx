"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { FileText, Loader2, Pencil, Trash2 } from "lucide-react"

export interface BookingRequestRow {
  id: string
  customer_id: string
  requested_by_id: string | null
  average_pallet_days: number
  requested_floor: string | null
  owner_of_product: string | null
  sku_count: number
  is_single_type: boolean
  status: string
  notes: string | null
  requires_approval: boolean
  created_at: string
  can_edit?: boolean
  can_delete?: boolean
}

const statusLabel: Record<string, string> = {
  pending: "Pending",
  quoted: "Quoted",
  accepted: "Approved",
  rejected: "Rejected",
}

export function BookingRequestsList() {
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    averagePalletDays: 0,
    requestedFloor: "",
    ownerOfProduct: "",
    skuCount: 0,
    isSingleType: true,
    notes: "",
    requiresApproval: true,
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["booking-requests"],
    queryFn: async () => {
      const res = await api.get<{ requests: BookingRequestRow[] }>("/api/v1/booking-requests", {
        showToast: false,
      })
      if (!res.success) return { requests: [] }
      return { requests: (res.data?.requests ?? []) as BookingRequestRow[] }
    },
  })

  const requests = data?.requests ?? []

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await api.patch<BookingRequestRow>(`/api/v1/booking-requests/${id}`, body, {
        showToast: false,
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] })
      setEditId(null)
      addNotification({ type: "success", message: "Request updated", duration: 5000 })
    },
    onError: (err: Error) => {
      addNotification({ type: "error", message: err.message || "Failed to update", duration: 5000 })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/v1/booking-requests/${id}`, { showToast: false })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] })
      setDeleteId(null)
      addNotification({ type: "success", message: "Request deleted", duration: 5000 })
    },
    onError: (err: Error) => {
      addNotification({ type: "error", message: err.message || "Failed to delete", duration: 5000 })
    },
  })

  const openEdit = (r: BookingRequestRow) => {
    setEditForm({
      averagePalletDays: r.average_pallet_days,
      requestedFloor: r.requested_floor ?? "",
      ownerOfProduct: r.owner_of_product ?? "",
      skuCount: r.sku_count,
      isSingleType: r.is_single_type,
      notes: r.notes ?? "",
      requiresApproval: r.requires_approval ?? true,
    })
    setEditId(r.id)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    patchMutation.mutate({
      id: editId,
      body: {
        averagePalletDays: editForm.averagePalletDays,
        requestedFloor: editForm.requestedFloor || undefined,
        ownerOfProduct: editForm.ownerOfProduct || undefined,
        skuCount: editForm.skuCount,
        isSingleType: editForm.isSingleType,
        notes: editForm.notes.trim() || undefined,
        requiresApproval: editForm.requiresApproval,
      },
    })
  }

  const handleDeleteConfirm = () => {
    if (deleteId) deleteMutation.mutate(deleteId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No booking requests yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a booking request from New Booking and choose &quot;Booking request&quot;
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/bookings/new">New Booking</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {r.average_pallet_days} days · {r.sku_count} SKU
                  {r.is_single_type ? " (single type)" : ""}
                </span>
                <Badge variant={r.status === "pending" ? "secondary" : "outline"}>
                  {statusLabel[r.status] ?? r.status}
                </Badge>
                {r.requires_approval !== false && (
                  <Badge variant="outline">Requires approval</Badge>
                )}
              </div>
              {r.requested_floor && (
                <p className="text-sm text-muted-foreground">Floor: {r.requested_floor}</p>
              )}
              {r.owner_of_product && (
                <p className="text-sm text-muted-foreground">Owner: {r.owner_of_product}</p>
              )}
              {r.notes && (
                <p className="text-sm text-muted-foreground">Note: {r.notes}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            {(r.can_edit || r.can_delete) && (
              <div className="flex items-center gap-2">
                {r.can_edit && (
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {r.can_delete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit booking request</DialogTitle>
            <DialogDescription>Update the request details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-averagePalletDays">Average days per pallet</Label>
              <Input
                id="edit-averagePalletDays"
                type="number"
                min={1}
                value={editForm.averagePalletDays}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, averagePalletDays: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-requestedFloor">Requested floor</Label>
              <Input
                id="edit-requestedFloor"
                value={editForm.requestedFloor}
                onChange={(e) => setEditForm((p) => ({ ...p, requestedFloor: e.target.value }))}
                placeholder="e.g. Ground, 1, 2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ownerOfProduct">Owner of product</Label>
              <Input
                id="edit-ownerOfProduct"
                value={editForm.ownerOfProduct}
                onChange={(e) => setEditForm((p) => ({ ...p, ownerOfProduct: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-skuCount">SKU count</Label>
              <Input
                id="edit-skuCount"
                type="number"
                min={1}
                value={editForm.skuCount}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, skuCount: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Special message (optional)</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="min-h-[80px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Single product type?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editForm.isSingleType ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((p) => ({ ...p, isSingleType: true }))}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!editForm.isSingleType ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((p) => ({ ...p, isSingleType: false }))}
                >
                  No
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Requires approval?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editForm.requiresApproval === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((p) => ({ ...p, requiresApproval: false }))}
                >
                  Pre-approved
                </Button>
                <Button
                  type="button"
                  variant={editForm.requiresApproval !== false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((p) => ({ ...p, requiresApproval: true }))}
                >
                  Requires approval
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={patchMutation.isPending}>
                {patchMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking request?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The request will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
