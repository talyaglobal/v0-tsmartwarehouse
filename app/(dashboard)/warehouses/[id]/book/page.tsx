'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { createBookingRequest } from '@/features/bookings/actions'
import { api } from '@/lib/api/client'
import type { Warehouse } from '@/types'

export default function BookWarehousePage() {
  const params = useParams()
  const router = useRouter()
  const warehouseId = params.id as string

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [bookingType, setBookingType] = useState<'pallet' | 'area-rental'>('pallet')
  const [palletCount, setPalletCount] = useState(0)
  const [areaSqFt, setAreaSqFt] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchWarehouse()
  }, [warehouseId])

  async function fetchWarehouse() {
    try {
      const result = await api.get(`/api/v1/warehouses/${warehouseId}`, {
        showToast: false,
      })
      if (result.success) {
        setWarehouse(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch warehouse:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const result = await createBookingRequest({
        warehouseId,
        type: bookingType,
        palletCount: bookingType === 'pallet' ? palletCount : undefined,
        areaSqFt: bookingType === 'area-rental' ? areaSqFt : undefined,
        startDate,
        endDate: endDate || undefined,
        notes: notes || undefined,
      })

      if (result.success) {
        router.push('/dashboard/bookings')
      } else {
        alert(result.error || 'Failed to create booking request')
      }
    } catch (error) {
      alert('Failed to create booking request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!warehouse) {
    return <div>Warehouse not found</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Book ${warehouse.name}`} />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Booking Type</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  type="button"
                  variant={bookingType === 'pallet' ? 'default' : 'outline'}
                  onClick={() => setBookingType('pallet')}
                >
                  Pallet Rental
                </Button>
                <Button
                  type="button"
                  variant={bookingType === 'area-rental' ? 'default' : 'outline'}
                  onClick={() => setBookingType('area-rental')}
                >
                  Area Rental
                </Button>
              </div>
            </div>

            {bookingType === 'pallet' ? (
              <div>
                <Label htmlFor="palletCount">Number of Pallets</Label>
                <Input
                  id="palletCount"
                  type="number"
                  min="1"
                  value={palletCount}
                  onChange={(e) => setPalletCount(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="areaSqFt">Area (sq ft)</Label>
                <Input
                  id="areaSqFt"
                  type="number"
                  min="40000"
                  value={areaSqFt}
                  onChange={(e) => setAreaSqFt(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Minimum 40,000 sq ft for area rental
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[100px] p-2 border rounded-md"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Submitting...' : 'Submit Booking Request'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warehouse Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-medium">
                {warehouse.address}, {warehouse.city}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Capacity</p>
              <p className="font-medium">{warehouse.totalSqFt.toLocaleString()} sq ft</p>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

