"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockIncidents, mockBookings, mockWorkers, mockCustomers } from "@/lib/mock-data"
import { formatDate, formatRelativeTime, getInitials } from "@/lib/utils/format"
import { ArrowLeft, Calendar, MapPin, Package, User, AlertTriangle, Send } from "lucide-react"
import Link from "next/link"

export default function IncidentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [note, setNote] = React.useState("")
  const [status, setStatus] = React.useState("")

  const incident = mockIncidents.find((i) => i.id === params.id)
  const booking = incident?.booking_id ? mockBookings.find((b) => b.id === incident.booking_id) : null
  const reporter = incident?.reported_by ? mockWorkers.find((w) => w.id === incident.reported_by) : null
  const customer = booking?.customer_id ? mockCustomers.find((c) => c.id === booking.customer_id) : null

  React.useEffect(() => {
    if (incident) {
      setStatus(incident.status)
    }
  }, [incident])

  if (!incident) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Incident not found</p>
      </div>
    )
  }

  const timeline = [
    {
      action: "Incident reported",
      user: reporter?.full_name || "Unknown",
      time: incident.reported_at,
    },
    {
      action: "Status changed to investigating",
      user: "System Admin",
      time: new Date(new Date(incident.reported_at).getTime() + 3600000).toISOString(),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={incident.incident_number} description={incident.title}>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/incidents">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button>Create Claim</Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Incident Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Incident Details</CardTitle>
                  <CardDescription>Reported {formatRelativeTime(incident.reported_at)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge type="severity" status={incident.severity} />
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      status === "open"
                        ? "bg-red-100 text-red-700"
                        : status === "investigating"
                          ? "bg-amber-100 text-amber-700"
                          : status === "resolved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{incident.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Occurred</p>
                    <p className="font-medium">{formatDate(incident.occurred_at, "PPpp")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{incident.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reported By</p>
                    <p className="font-medium">{reporter?.full_name || "Unknown"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-muted-foreground">{incident.description}</p>
              </div>

              {incident.affected_items.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Affected Items</h4>
                    <div className="flex flex-wrap gap-2">
                      {incident.affected_items.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-sm font-mono"
                        >
                          <Package className="mr-1 h-3 w-3" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.map((event, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                      {index < timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium">{event.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.user} • {formatRelativeTime(event.time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Add Note */}
          <Card>
            <CardHeader>
              <CardTitle>Add Note</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Textarea
                  placeholder="Add investigation notes, updates, or resolution details..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button>
                  <Send className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Update Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full">Save Changes</Button>
            </CardContent>
          </Card>

          {/* Related Booking */}
          {booking && (
            <Card>
              <CardHeader>
                <CardTitle>Related Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Booking #</span>
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {booking.booking_number}
                    </Link>
                  </div>
                  {customer && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Customer</span>
                      <span className="text-sm font-medium">{customer.full_name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge type="booking" status={booking.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reporter */}
          {reporter && (
            <Card>
              <CardHeader>
                <CardTitle>Reported By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(reporter.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{reporter.full_name}</p>
                    <p className="text-sm text-muted-foreground">{reporter.department}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
