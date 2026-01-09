"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, CheckCircle, XCircle } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { CRMContact } from "@/types"
import Link from "next/link"

export default function AdminCRMPage() {
  const [contacts, setContacts] = useState<CRMContact[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingApprovals, setPendingApprovals] = useState(0)

  useEffect(() => {
    fetchCRMData()
  }, [])

  const fetchCRMData = async () => {
    try {
      setLoading(true)
      const [contactsRes] = await Promise.all([
        api.get<CRMContact[]>("/api/v1/crm/contacts?limit=50"),
      ])

      if (contactsRes.success) {
        setContacts(contactsRes.data || [])
        setPendingApprovals((contactsRes.data || []).filter(c => c.requiresApproval).length)
      }
    } catch (error) {
      console.error("Failed to fetch CRM data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (contactId: string, action: "approve" | "reject") => {
    try {
      const result = await api.post(`/api/v1/crm/contacts/${contactId}/approve`, {
        action,
        notes: action === "approve" ? "Approved by admin" : "Rejected by admin",
      })

      if (result.success) {
        fetchCRMData()
      }
    } catch (error) {
      console.error("Failed to process approval:", error)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  const warehouseSuppliers = contacts.filter(c => c.contactType === "warehouse_supplier")
  const customerLeads = contacts.filter(c => c.contactType === "customer_lead")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CRM Management</h1>
        <Link href="/admin/crm/approvals">
          <Button variant="outline">
            <CheckCircle className="h-4 w-4 mr-2" />
            Approval Queue ({pendingApprovals})
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Warehouse Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warehouseSuppliers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerLeads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>All CRM Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{contact.contactName}</h3>
                    <Badge variant="outline">{contact.contactType}</Badge>
                    <Badge variant="outline">{contact.status}</Badge>
                    <Badge variant="secondary">{contact.pipelineStage}%</Badge>
                  </div>
                  {contact.companyName && (
                    <p className="text-sm text-muted-foreground mt-1">{contact.companyName}</p>
                  )}
                </div>
                {contact.requiresApproval && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproval(contact.id, "approve")}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproval(contact.id, "reject")}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

