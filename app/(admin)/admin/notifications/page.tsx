"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, MessageSquare, Smartphone, Send, Plus } from "@/components/icons"

const notificationTemplates = [
  { id: "booking-confirmed", name: "Booking Confirmed", channel: "email", active: true },
  { id: "booking-reminder", name: "Booking Reminder", channel: "email", active: true },
  { id: "invoice-created", name: "Invoice Created", channel: "email", active: true },
  { id: "invoice-due", name: "Invoice Due Reminder", channel: "email", active: true },
  { id: "task-assigned", name: "Task Assigned", channel: "push", active: true },
  { id: "incident-reported", name: "Incident Reported", channel: "email", active: false },
]

export default function NotificationsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(notificationTemplates[0])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Configure notification templates and channels"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        }
      />

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Select a template to edit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {notificationTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                      selectedTemplate.id === template.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {template.channel === "email" && <Mail className="h-4 w-4" />}
                      {template.channel === "push" && <Smartphone className="h-4 w-4" />}
                      {template.channel === "sms" && <MessageSquare className="h-4 w-4" />}
                      <span className="text-sm font-medium">{template.name}</span>
                    </div>
                    <div className={`h-2 w-2 rounded-full ${template.active ? "bg-green-500" : "bg-gray-300"}`} />
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Edit Template</CardTitle>
                <CardDescription>{selectedTemplate.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input defaultValue={selectedTemplate.name} />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select defaultValue={selectedTemplate.channel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="push">Push Notification</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input defaultValue="Your booking has been confirmed" />
                </div>

                <div className="space-y-2">
                  <Label>Message Body</Label>
                  <Textarea
                    rows={6}
                    defaultValue={`Hi {{customer_name}},

Your booking #{{booking_id}} has been confirmed.

Details:
- Service: {{service_type}}
- Start Date: {{start_date}}
- Amount: {{total_amount}}

Thank you for choosing TSmart Warehouse!`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch defaultChecked={selectedTemplate.active} />
                    <Label>Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Send className="mr-2 h-4 w-4" />
                      Test Send
                    </Button>
                    <Button>Save Template</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <CardTitle>Email (Resend)</CardTitle>
                </div>
                <CardDescription>Transactional email notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status</span>
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input defaultValue="notifications@tsmart.com" />
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  Configure
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle>SMS (Twilio)</CardTitle>
                </div>
                <CardDescription>Text message notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status</span>
                  <span className="text-sm text-yellow-600 font-medium">Not Configured</span>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  Connect Twilio
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>Last 50 sent notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">Notification history will appear here</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
