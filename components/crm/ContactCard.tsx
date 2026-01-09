"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Mail, MapPin, Calendar, Building2 } from "@/components/icons"
import type { CRMContact } from "@/types"
import { formatDate } from "@/lib/utils/format"

interface ContactCardProps {
  contact: CRMContact
  onView?: (contact: CRMContact) => void
  onCall?: (contact: CRMContact) => void
  onEmail?: (contact: CRMContact) => void
  onScheduleVisit?: (contact: CRMContact) => void
}

export function ContactCard({
  contact,
  onView,
  onCall,
  onEmail,
  onScheduleVisit,
}: ContactCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "converted":
        return "bg-blue-100 text-blue-800"
      case "active":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView?.(contact)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{contact.contactName}</CardTitle>
            {contact.companyName && (
              <p className="text-sm text-muted-foreground mt-1">{contact.companyName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getPriorityColor(contact.priority)}`} />
            <Badge variant="outline" className={getStatusColor(contact.status)}>
              {contact.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {contact.email}
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {contact.phone}
            </div>
          )}
          {contact.city && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {contact.city}
              {contact.state && `, ${contact.state}`}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Stage:</span>
            <Badge variant="secondary">{contact.pipelineStage}%</Badge>
            <span className="text-muted-foreground text-xs">{contact.pipelineMilestone}</span>
          </div>
          {contact.nextFollowUpDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Follow-up: {formatDate(contact.nextFollowUpDate)}
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          {onCall && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onCall(contact); }}>
              <Phone className="h-3 w-3 mr-1" />
              Call
            </Button>
          )}
          {onEmail && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEmail(contact); }}>
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          )}
          {onScheduleVisit && contact.contactType === "warehouse_supplier" && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onScheduleVisit(contact); }}>
              <Calendar className="h-3 w-3 mr-1" />
              Visit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

