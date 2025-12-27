"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AppointmentTypeBadge } from "./appointment-type-badge"
import { formatDateTime } from "@/lib/utils/format"
import { MapPin, Phone, Calendar, User, Clock, Link } from "@/components/icons"
import type { Appointment } from "@/types"

interface AppointmentDetailsProps {
  appointment: Appointment
  onEdit?: () => void
  onCancel?: () => void
  canEdit?: boolean
}

export function AppointmentDetails({ appointment, onEdit, onCancel, canEdit = false }: AppointmentDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{appointment.title}</h3>
          {appointment.appointmentType && (
            <AppointmentTypeBadge appointmentType={appointment.appointmentType} className="mt-2" />
          )}
        </div>
        <Badge variant={appointment.status === 'confirmed' ? 'default' : 'secondary'}>
          {appointment.status}
        </Badge>
      </div>

      {appointment.description && (
        <div>
          <p className="text-sm text-muted-foreground">{appointment.description}</p>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Start:</span>
          <span>{formatDateTime(appointment.startTime)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">End:</span>
          <span>{formatDateTime(appointment.endTime)}</span>
        </div>

        {appointment.warehouse && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Warehouse:</span>
            <span>{appointment.warehouse.name}</span>
          </div>
        )}

        {appointment.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Location:</span>
            <span>{appointment.location}</span>
          </div>
        )}

        {appointment.meetingLink && (
          <div className="flex items-center gap-2 text-sm">
            <Link className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Meeting Link:</span>
            <a href={appointment.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Join Meeting
            </a>
          </div>
        )}

        {appointment.phoneNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Phone:</span>
            <a href={`tel:${appointment.phoneNumber}`} className="text-primary hover:underline">
              {appointment.phoneNumber}
            </a>
          </div>
        )}

        {appointment.createdByName && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Created by:</span>
            <span>{appointment.createdByName}</span>
          </div>
        )}
      </div>

      {appointment.participants && appointment.participants.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">Participants ({appointment.participants.length})</h4>
            <div className="space-y-1">
              {appointment.participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span>{participant.userName || participant.userEmail}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {participant.role}
                    </Badge>
                  </div>
                  <Badge variant={participant.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">
                    {participant.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {appointment.notes && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">Notes</h4>
            <p className="text-sm text-muted-foreground">{appointment.notes}</p>
          </div>
        </>
      )}

      {canEdit && (onEdit || onCancel) && (
        <>
          <Separator />
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" onClick={onEdit} className="flex-1">
                Edit
              </Button>
            )}
            {onCancel && appointment.status !== 'cancelled' && (
              <Button variant="destructive" onClick={onCancel} className="flex-1">
                Cancel Appointment
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

