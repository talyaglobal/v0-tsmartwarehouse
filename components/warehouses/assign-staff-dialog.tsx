"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, X, Plus } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { Warehouse } from "@/types"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/stores/ui.store"

interface WarehouseStaff {
  id: string
  name: string
  email: string
  role: string
  company_id: string
}

interface AssignedStaff {
  id: string
  user_id: string
  role: "manager" | "staff"
  created_at: string
  profiles: {
    id: string
    name: string
    email: string
  }
}

interface AssignStaffDialogProps {
  warehouse: Warehouse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignStaffDialog({ warehouse, open, onOpenChange }: AssignStaffDialogProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { addNotification } = useUIStore()
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  // Default role is always "staff"
  const selectedRole: "manager" | "staff" = "staff"

  // Fetch available warehouse staff
  const { data: availableStaff = [], isLoading: staffLoading } = useQuery<WarehouseStaff[]>({
    queryKey: ['company-warehouse-staff'],
    queryFn: async () => {
      const result = await api.get<WarehouseStaff[]>('/api/v1/companies/warehouse-staff', { showToast: false })
      if (!result.success) {
        console.error('Failed to fetch warehouse staff:', result.error)
        return []
      }
      const staff = result.data || []
      console.log('Fetched warehouse staff:', staff)
      return staff
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: true,
  })

  // Fetch already assigned staff
  const { data: assignedStaff = [], isLoading: assignedLoading } = useQuery<AssignedStaff[]>({
    queryKey: ['warehouse-staff', warehouse?.id],
    queryFn: async () => {
      if (!warehouse?.id) return []
      const result = await api.get<AssignedStaff[]>(`/api/v1/warehouses/${warehouse.id}/staff`, { showToast: false })
      if (!result.success) {
        console.error('Failed to fetch assigned staff:', result.error)
        return []
      }
      const staff = result.data || []
      console.log('Fetched assigned staff:', staff)
      return staff
    },
    enabled: open && !!warehouse?.id,
    staleTime: 0,
    refetchOnMount: true,
  })

  // Assign staff mutation
  const assignStaffMutation = useMutation({
    mutationFn: async () => {
      if (!warehouse?.id || selectedStaffIds.length === 0) {
        throw new Error("Please select at least one staff member")
      }
      
      // Assign all selected staff members
      const results = await Promise.all(
        selectedStaffIds.map((staffId) =>
          api.post(
            `/api/v1/warehouses/${warehouse.id}/staff`,
            {
              userId: staffId,
              role: selectedRole,
            },
            {
              showToast: false, // We'll show a custom message
            }
          )
        )
      )
      
      // Check if all assignments succeeded
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        throw new Error(`Failed to assign ${failed.length} staff member(s)`)
      }
      
      return results.map(r => r.data)
    },
    onSuccess: (data, variables) => {
      const count = selectedStaffIds.length
      queryClient.invalidateQueries({ queryKey: ['warehouse-staff', warehouse?.id] })
      queryClient.invalidateQueries({ queryKey: ['company-warehouse-staff'] })
      setSelectedStaffIds([])
      addNotification({
        type: 'success',
        message: `Successfully assigned ${count} staff member(s)`,
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to assign staff',
        duration: 5000,
      })
    },
  })

  // Remove staff mutation
  const removeStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!warehouse?.id) return
      const result = await api.delete(
        `/api/v1/warehouses/${warehouse.id}/staff?userId=${userId}`,
        {
          successMessage: "Staff removed successfully",
          errorMessage: "Failed to remove staff",
        }
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to remove staff")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-staff', warehouse?.id] })
    },
  })

  // Filter out already assigned staff
  const assignedStaffIds = new Set(assignedStaff.map(s => s.user_id))
  const unassignedStaff = availableStaff.filter(s => !assignedStaffIds.has(s.id))
  
  console.log('Available staff:', availableStaff.length)
  console.log('Assigned staff:', assignedStaff.length)
  console.log('Unassigned staff:', unassignedStaff.length)
  console.log('Assigned staff IDs:', Array.from(assignedStaffIds))
  console.log('Available staff IDs:', availableStaff.map(s => s.id))

  const handleAssign = () => {
    if (selectedStaffIds.length === 0) {
      // Error will be handled by the mutation's errorMessage option
      return
    }
    assignStaffMutation.mutate()
  }

  const handleToggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    )
  }

  const handleRemove = (userId: string) => {
    if (confirm("Are you sure you want to remove this staff member from this warehouse?")) {
      removeStaffMutation.mutate(userId)
    }
  }

  // Reset selections when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedStaffIds([])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Warehouse Staff</DialogTitle>
          <DialogDescription>
            Assign warehouse staff members to {warehouse?.name}. Staff members can manage bookings and inventory for this warehouse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assigned Staff List */}
          {assignedLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignedStaff.length > 0 ? (
            <div>
              <Label className="text-sm font-semibold mb-2 block">Currently Assigned Staff</Label>
              <div className="space-y-2">
                {assignedStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{staff.profiles?.name || staff.profiles?.email || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{staff.profiles?.email || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {staff.role}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(staff.user_id)}
                        disabled={removeStaffMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Assign New Staff */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-sm font-semibold">Assign New Staff</Label>
            
            {staffLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : availableStaff.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-4 text-muted-foreground">
                  <p className="mb-4">No warehouse staff members found in your company.</p>
                  <Button 
                    variant="default"
                    onClick={() => {
                      router.push("/dashboard/my-company?tab=team&openAddMember=true&role=warehouse_staff")
                      onOpenChange(false)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Warehouse Staff
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Select Staff Members</Label>
                  {unassignedStaff.length > 0 ? (
                    <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-3">
                      {unassignedStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => handleToggleStaff(staff.id)}
                        >
                          <Checkbox
                            id={`staff-${staff.id}`}
                            checked={selectedStaffIds.includes(staff.id)}
                            onCheckedChange={() => handleToggleStaff(staff.id)}
                          />
                          <Label
                            htmlFor={`staff-${staff.id}`}
                            className="flex-1 cursor-pointer font-normal"
                          >
                            {staff.name} ({staff.email})
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center border rounded-md mt-2">
                      All staff members are already assigned
                    </div>
                  )}
                  {availableStaff.length > 0 && unassignedStaff.length === 0 && (
                    <div className="mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          router.push("/dashboard/my-company?tab=team&openAddMember=true&role=warehouse_staff")
                          onOpenChange(false)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Warehouse Staff
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {unassignedStaff.length > 0 && availableStaff.length > 0 && (
            <Button
              onClick={handleAssign}
              disabled={selectedStaffIds.length === 0 || assignStaffMutation.isPending}
            >
              {assignStaffMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign {selectedStaffIds.length > 0 ? `(${selectedStaffIds.length})` : ''} Staff
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

