'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, DollarSign, Loader2 } from '@/components/icons'
import { api } from '@/lib/api/client'
import { useToast } from '@/lib/hooks/use-toast'
import { CompanyServiceDialog } from './company-service-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface CompanyService {
  id: string
  service_name: string
  service_description?: string
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CompanyServicesTabProps {
  services: CompanyService[]
  onServiceCreated: (service: CompanyService) => void
  onServiceUpdated: (service: CompanyService) => void
  onServiceDeleted: (serviceId: string) => void
}

const pricingTypeLabels: Record<string, string> = {
  one_time: 'One Time',
  per_pallet: 'Per Pallet',
  per_sqft: 'Per Sq Ft',
  per_day: 'Per Day',
  per_month: 'Per Month',
}

export function CompanyServicesTab({
  services,
  onServiceCreated,
  onServiceUpdated,
  onServiceDeleted,
}: CompanyServicesTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<CompanyService | null>(null)
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const handleCreate = () => {
    setEditingService(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (service: CompanyService) => {
    setEditingService(service)
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingServiceId) return

    try {
      setIsDeleting(true)
      const response = await api.delete(`/api/v1/company-services/${deletingServiceId}`, { showToast: false })

      if (response.success) {
        onServiceDeleted(deletingServiceId)
        setDeletingServiceId(null)
      } else {
        throw new Error(response.error || 'Failed to delete service')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete service',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Company Service Templates</h2>
          <p className="text-muted-foreground">
            Create service templates that can be mapped to your warehouses
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Service Template
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No service templates created yet
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Service Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Pricing Type</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">
                    {service.service_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {service.service_description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {pricingTypeLabels[service.pricing_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4" />
                      {service.base_price.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={service.is_active ? 'default' : 'secondary'}>
                      {service.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingServiceId(service.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CompanyServiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        service={editingService}
        onSuccess={(service) => {
          if (editingService) {
            onServiceUpdated(service as CompanyService)
          } else {
            onServiceCreated(service as CompanyService)
          }
          setIsDialogOpen(false)
        }}
      />

      <AlertDialog
        open={deletingServiceId !== null}
        onOpenChange={(open) => !open && setDeletingServiceId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the service template. Services already mapped to warehouses
              will remain, but you won't be able to map this template to new warehouses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

