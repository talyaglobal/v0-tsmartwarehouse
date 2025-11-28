"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockBookings, mockWarehouses } from "@/lib/mock-data"
import { ArrowLeft, Upload, Plus, X } from "lucide-react"
import Link from "next/link"

export default function NewIncidentPage() {
  const router = useRouter()
  const [affectedItems, setAffectedItems] = React.useState<string[]>([""])

  const addAffectedItem = () => {
    setAffectedItems([...affectedItems, ""])
  }

  const removeAffectedItem = (index: number) => {
    setAffectedItems(affectedItems.filter((_, i) => i !== index))
  }

  const updateAffectedItem = (index: number, value: string) => {
    const updated = [...affectedItems]
    updated[index] = value
    setAffectedItems(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/admin/incidents")
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Report Incident" description="Document a new warehouse incident">
        <Button variant="outline" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Link>
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Details</CardTitle>
              <CardDescription>Provide information about the incident</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Incident Title</Label>
                <Input id="title" placeholder="Brief description of incident" required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Incident Type</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damage">Damage</SelectItem>
                      <SelectItem value="loss">Loss</SelectItem>
                      <SelectItem value="theft">Theft</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed description of what happened..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="occurred_at">Date & Time Occurred</Label>
                  <Input id="occurred_at" type="datetime-local" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="e.g., Zone A, Rack 01" required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Information */}
          <Card>
            <CardHeader>
              <CardTitle>Related Information</CardTitle>
              <CardDescription>Link to bookings and warehouses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockWarehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking">Related Booking (Optional)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockBookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.booking_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Affected Items */}
              <div className="space-y-2">
                <Label>Affected Items (SKUs)</Label>
                {affectedItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Enter SKU"
                      value={item}
                      onChange={(e) => updateAffectedItem(index, e.target.value)}
                    />
                    {affectedItems.length > 1 && (
                      <Button type="button" variant="outline" size="icon" onClick={() => removeAffectedItem(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addAffectedItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photos/Evidence</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Drag and drop files or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB each</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3 bg-transparent">
                    Choose Files
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/incidents">Cancel</Link>
          </Button>
          <Button type="submit">Report Incident</Button>
        </div>
      </form>
    </div>
  )
}
