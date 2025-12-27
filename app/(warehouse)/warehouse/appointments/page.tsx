"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Plus } from "@/components/icons"
import { CalendarView } from "@/components/calendar/calendar-view"
import { ViewSwitcher } from "@/components/calendar/view-switcher"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { AppointmentDetails } from "@/components/appointments/appointment-details"
import { useUser } from "@/lib/hooks/use-user"
import { useUIStore } from "@/stores/ui.store"
import type { Appointment } from "@/types"
import type { CalendarEvent, CalendarView as CalendarViewType } from "@/types/calendar"

export default function AppointmentsPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [currentView, setCurrentView] = useState<CalendarViewType>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch appointments
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user) return []
      const response = await fetch('/api/v1/appointments')
      if (!response.ok) throw new Error('Failed to fetch appointments')
      const data = await response.json()
      return data.data || []
    },
    enabled: !!user,
  })

  // Transform appointments to calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return appointments.map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      start: new Date(appointment.startTime),
      end: new Date(appointment.endTime),
      type: 'appointment' as const,
      resource: {
        originalType: 'appointment' as const,
        data: appointment,
        filterKeys: [
          `appointment-${appointment.status}`,
          appointment.appointmentType?.slug ? `appointment-type-${appointment.appointmentType.slug}` : '',
        ].filter(Boolean) as any[],
      },
      color: appointment.appointmentType?.color,
      description: appointment.description,
    }))
  }, [appointments])

  const handleCreateAppointment = async (data: Parameters<typeof AppointmentForm>[0]['onSubmit'] extends (data: infer T) => Promise<void> ? T : never) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create appointment')
      }

      addNotification({
        type: 'success',
        message: 'Appointment created successfully',
      })

      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setShowCreateDialog(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to create appointment',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEventSelect = (event: CalendarEvent) => {
    if (event.resource.originalType === 'appointment') {
      const appointment = event.resource.data as Appointment
      setSelectedAppointment(appointment)
      setShowDetailsDialog(true)
    }
  }

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/v1/appointments/${selectedAppointment.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel appointment')
      }

      addNotification({
        type: 'success',
        message: 'Appointment cancelled successfully',
      })

      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setShowDetailsDialog(false)
      setSelectedAppointment(null)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to cancel appointment',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-6">
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <PageHeader 
          title="Appointments" 
          description="Schedule and manage warehouse appointments"
        />
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      </div>
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - View Switcher */}
        <ViewSwitcher 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />

        {/* Main Calendar Area */}
        <div className="flex-1 p-4 overflow-hidden min-h-0">
          <div className="h-full">
            <CalendarView
              events={calendarEvents}
              currentView={currentView}
              currentDate={currentDate}
              onViewChange={setCurrentView}
              onNavigate={setCurrentDate}
              onSelectEvent={handleEventSelect}
            />
          </div>
        </div>
      </div>

      {/* Create Appointment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Appointment</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            onSubmit={handleCreateAppointment}
            onCancel={() => setShowCreateDialog(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Appointment Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <AppointmentDetails
              appointment={selectedAppointment}
              onCancel={handleCancelAppointment}
              canEdit={selectedAppointment.createdBy === user?.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

