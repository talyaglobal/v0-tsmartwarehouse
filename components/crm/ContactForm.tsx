"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CRMContact, ContactType } from "@/types"
import { api } from "@/lib/api/client"

interface ContactFormProps {
  contactType: ContactType
  contact?: CRMContact
  onSuccess?: () => void
  onCancel?: () => void
}

export function ContactForm({ contactType, contact, onSuccess, onCancel }: ContactFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    contactName: contact?.contactName || "",
    companyName: contact?.companyName || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    secondaryPhone: contact?.secondaryPhone || "",
    address: contact?.address || "",
    city: contact?.city || "",
    state: contact?.state || "",
    country: contact?.country || "Turkey",
    postalCode: contact?.postalCode || "",
    priority: contact?.priority || "medium",
    // Warehouse supplier fields
    warehouseSizeSqm: contact?.warehouseSizeSqm?.toString() || "",
    warehouseType: contact?.warehouseType || [],
    // Customer lead fields
    industry: contact?.industry || "",
    companySize: contact?.companySize || "",
    estimatedSpaceNeedSqm: contact?.estimatedSpaceNeedSqm?.toString() || "",
    budgetRange: contact?.budgetRange || "",
    decisionMakerName: contact?.decisionMakerName || "",
    decisionMakerTitle: contact?.decisionMakerTitle || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload: any = {
        contactName: formData.contactName,
        companyName: formData.companyName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        secondaryPhone: formData.secondaryPhone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        country: formData.country,
        postalCode: formData.postalCode || undefined,
        priority: formData.priority,
      }

      if (contactType === "warehouse_supplier") {
        if (formData.warehouseSizeSqm) {
          payload.warehouseSizeSqm = parseFloat(formData.warehouseSizeSqm)
        }
        if (formData.warehouseType.length > 0) {
          payload.warehouseType = formData.warehouseType
        }
      } else {
        payload.industry = formData.industry || undefined
        payload.companySize = formData.companySize || undefined
        if (formData.estimatedSpaceNeedSqm) {
          payload.estimatedSpaceNeedSqm = parseFloat(formData.estimatedSpaceNeedSqm)
        }
        payload.budgetRange = formData.budgetRange || undefined
        payload.decisionMakerName = formData.decisionMakerName || undefined
        payload.decisionMakerTitle = formData.decisionMakerTitle || undefined
      }

      if (contact) {
        // Update existing contact
        const result = await api.patch(`/api/v1/crm/contacts/${contact.id}`, payload)
        if (result.success) {
          onSuccess?.()
        }
      } else {
        // Create new contact
        const result = await api.post("/api/v1/crm/contacts", payload)
        if (result.success) {
          onSuccess?.()
        }
      }
    } catch (error) {
      console.error("Failed to save contact:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contact ? "Edit Contact" : "New Contact"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactName">Contact Name *</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {contactType === "warehouse_supplier" && (
            <div>
              <Label htmlFor="warehouseSizeSqm">Warehouse Size (sqm)</Label>
              <Input
                id="warehouseSizeSqm"
                type="number"
                value={formData.warehouseSizeSqm}
                onChange={(e) => setFormData({ ...formData, warehouseSizeSqm: e.target.value })}
              />
            </div>
          )}

          {contactType === "customer_lead" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select
                    value={formData.companySize}
                    onValueChange={(value) => setFormData({ ...formData, companySize: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startup">Startup</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="estimatedSpaceNeedSqm">Estimated Space Need (sqm)</Label>
                <Input
                  id="estimatedSpaceNeedSqm"
                  type="number"
                  value={formData.estimatedSpaceNeedSqm}
                  onChange={(e) => setFormData({ ...formData, estimatedSpaceNeedSqm: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : contact ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

