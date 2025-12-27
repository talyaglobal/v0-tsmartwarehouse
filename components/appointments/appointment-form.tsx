"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "@/components/icons"
import { ParticipantSelector } from "./participant-selector"
import type { Appointment, AppointmentType, Warehouse } from "@/types"

interface AppointmentFormProps {
  appointment?: Appointment
  onSubmit: (data: {
    warehouseId: string
    appointmentTypeId: string
    title: string
    description?: string
    startTime: string
    endTime: string
    location?: string
    meetingLink?: string
    phoneNumber?: string
    notes?: string
    participantIds?: string[]
  }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function AppointmentForm({ appointment, onSubmit, onCancel, isLoading }: AppointmentFormProps) {
  const [warehouseId, setWarehouseId] = useState(appointment?.warehouseId || "")
  const [appointmentTypeId, setAppointmentTypeId] = useState(appointment?.appointmentTypeId || "")
  const [title, setTitle] = useState(appointment?.title || "")
  const [description, setDescription] = useState(appointment?.description || "")
  const [startTime, setStartTime] = useState(
    appointment?.startTime ? new Date(appointment.startTime).toISOString().slice(0, 16) : ""
  )
  const [endTime, setEndTime] = useState(
    appointment?.endTime ? new Date(appointment.endTime).toISOString().slice(0, 16) : ""
  )
  const [location, setLocation] = useState(appointment?.location || "")
  const [meetingLink, setMeetingLink] = useState(appointment?.meetingLink || "")
  const [phoneNumber, setPhoneNumber] = useState(appointment?.phoneNumber || "")
  const [notes, setNotes] = useState(appointment?.notes || "")
  const [participantIds, setParticipantIds] = useState<string[]>(
    appointment?.participants?.map(p => p.userId) || []
  )

  // Fetch appointment types
  const { data: appointmentTypes = [] } = useQuery<AppointmentType[]>({
    queryKey: ['appointment-types'],
    queryFn: async () => {
      const response = await fetch('/api/v1/appointment-types')
      if (!response.ok) throw new Error('Failed to fetch appointment types')
      const data = await response.json()
      return data.data || []
    },
  })

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await fetch('/api/v1/warehouses')
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      const data = await response.json()
      return data.data || []
    },
  })

  const selectedType = appointmentTypes.find(t => t.id === appointmentTypeId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!warehouseId || !appointmentTypeId || !title || !startTime || !endTime) {
      return
    }

    await onSubmit({
      warehouseId,
      appointmentTypeId,
      title,
      description: description || undefined,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      location: location || undefined,
      meetingLink: meetingLink || undefined,
      phoneNumber: phoneNumber || undefined,
      notes: notes || undefined,
      participantIds: participantIds.length > 0 ? participantIds : undefined,
    })
  }

  // Auto-set end time based on appointment type duration
  useEffect(() => {
    if (selectedType && startTime) {
      const start = new Date(startTime)
      const end = new Date(start.getTime() + selectedType.durationMinutes * 60000)
      setEndTime(end.toISOString().slice(0, 16))
    }
  }, [selectedType, startTime])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="warehouse">Warehouse *</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId} required>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appointmentType">Appointment Type *</Label>
          <Select value={appointmentTypeId} onValueChange={setAppointmentTypeId} required>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {appointmentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Appointment title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Appointment description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Time *</Label>
          <Input
            id="startTime"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">End Time *</Label>
          <Input
            id="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
      </div>

      {selectedType?.slug === 'online-meeting-request' && (
        <div className="space-y-2">
          <Label htmlFor="meetingLink">Meeting Link</Label>
          <Input
            id="meetingLink"
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://meet.google.com/..."
          />
        </div>
      )}

      {selectedType?.slug === 'phone-meeting-request' && (
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>
      )}

      {selectedType?.slug === 'visit-request' && (
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Warehouse address or specific location"
          />
        </div>
      )}

      <ParticipantSelector
        selectedUserIds={participantIds}
        onChange={setParticipantIds}
        excludeUserIds={appointment?.createdBy ? [appointment.createdBy] : []}
      />

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !warehouseId || !appointmentTypeId || !title || !startTime || !endTime}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {appointment ? "Update" : "Create"} Appointment
        </Button>
      </div>
    </form>
  )
}

