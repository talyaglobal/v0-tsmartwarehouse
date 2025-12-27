"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Edit, Trash2, Check, X } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"
import { useUIStore } from "@/stores/ui.store"
import { createClient } from "@/lib/supabase/client"
import type { AppointmentType } from "@/types"

interface AppointmentTypeFormData {
  name: string
  slug: string
  description?: string
  color: string
  icon?: string
  durationMinutes: number
  requiresWarehouseStaff: boolean
  isActive: boolean
}

export default function AppointmentTypesPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingType, setEditingType] = useState<AppointmentType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRoot, setIsRoot] = useState(false)

  // Check if user is root admin
  useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return false
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsRoot(profile?.role === 'root')
      return profile?.role === 'root'
    },
    enabled: !!user,
  })

  // Fetch appointment types
  const { data: appointmentTypes = [], isLoading } = useQuery<AppointmentType[]>({
    queryKey: ['appointment-types', true], // include inactive
    queryFn: async () => {
      const response = await fetch('/api/v1/appointment-types?includeInactive=true')
      if (!response.ok) throw new Error('Failed to fetch appointment types')
      const data = await response.json()
      return data.data || []
    },
  })

  const handleCreate = async (formData: AppointmentTypeFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/v1/appointment-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create appointment type')
      }

      addNotification({
        type: 'success',
        message: 'Appointment type created successfully',
      })

      queryClient.invalidateQueries({ queryKey: ['appointment-types'] })
      setShowCreateDialog(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to create appointment type',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (id: string, formData: Partial<AppointmentTypeFormData>) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/v1/appointment-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update appointment type')
      }

      addNotification({
        type: 'success',
        message: 'Appointment type updated successfully',
      })

      queryClient.invalidateQueries({ queryKey: ['appointment-types'] })
      setEditingType(null)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to update appointment type',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this appointment type?')) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/v1/appointment-types/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete appointment type')
      }

      addNotification({
        type: 'success',
        message: 'Appointment type deleted successfully',
      })

      queryClient.invalidateQueries({ queryKey: ['appointment-types'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to delete appointment type',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isRoot) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Only root admin can manage appointment types
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Appointment Types" 
          description="Manage appointment types that can be used when creating appointments"
        />
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Type
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {appointmentTypes.map((type) => (
          <Card key={type.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{type.name}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingType(type)}
                    disabled={isSubmitting}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(type.id)}
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  style={{ backgroundColor: type.color }}
                  className="text-white"
                >
                  {type.name}
                </Badge>
                {type.isActive ? (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <X className="h-3 w-3" />
                    Inactive
                  </Badge>
                )}
              </div>

              {type.description && (
                <p className="text-sm text-muted-foreground">{type.description}</p>
              )}

              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium">Duration:</span> {type.durationMinutes} minutes
                </div>
                {type.requiresWarehouseStaff && (
                  <div>
                    <Badge variant="outline">Requires Staff</Badge>
                  </div>
                )}
                {type.slug && (
                  <div>
                    <span className="font-medium">Slug:</span> {type.slug}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <AppointmentTypeFormDialog
        open={showCreateDialog || !!editingType}
        onClose={() => {
          setShowCreateDialog(false)
          setEditingType(null)
        }}
        editingType={editingType}
        onSubmit={editingType 
          ? (data) => handleUpdate(editingType.id, data)
          : handleCreate
        }
        isLoading={isSubmitting}
      />
    </div>
  )
}

function AppointmentTypeFormDialog({
  open,
  onClose,
  editingType,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onClose: () => void
  editingType: AppointmentType | null
  onSubmit: (data: AppointmentTypeFormData) => Promise<void>
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<AppointmentTypeFormData>({
    name: editingType?.name || '',
    slug: editingType?.slug || '',
    description: editingType?.description || '',
    color: editingType?.color || '#3b82f6',
    icon: editingType?.icon || '',
    durationMinutes: editingType?.durationMinutes || 60,
    requiresWarehouseStaff: editingType?.requiresWarehouseStaff || false,
    isActive: editingType?.isActive ?? true,
  })

  // Update form when editing type changes
  useEffect(() => {
    if (editingType) {
      setFormData({
        name: editingType.name,
        slug: editingType.slug,
        description: editingType.description || '',
        color: editingType.color,
        icon: editingType.icon || '',
        durationMinutes: editingType.durationMinutes,
        requiresWarehouseStaff: editingType.requiresWarehouseStaff,
        isActive: editingType.isActive,
      })
    } else if (open && !editingType) {
      setFormData({
        name: '',
        slug: '',
        description: '',
        color: '#3b82f6',
        icon: '',
        durationMinutes: 60,
        requiresWarehouseStaff: false,
        isActive: true,
      })
    }
  }, [editingType, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  // Generate slug from name
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingType ? 'Edit' : 'Create'} Appointment Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                required
                pattern="[a-z0-9-]+"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Color *</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 border rounded"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (minutes) *</label>
              <input
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 60 }))}
                min={1}
                max={1440}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Icon (optional)</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
              placeholder="Icon name or identifier"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requiresWarehouseStaff}
                onChange={(e) => setFormData(prev => ({ ...prev, requiresWarehouseStaff: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Requires warehouse staff</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingType ? 'Update' : 'Create'} Type
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

