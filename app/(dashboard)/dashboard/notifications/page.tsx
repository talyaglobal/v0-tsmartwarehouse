"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Bell, Package, FileText, AlertCircle, CheckCircle, Mail, Smartphone, Settings } from "@/components/icons"
import { CheckCircle2 } from "lucide-react"
import { useRealtimeNotifications } from "@/lib/realtime"
import { useUser } from "@/lib/hooks/use-user"
import { formatDate } from "@/lib/utils/format"
import type { Notification, NotificationType } from "@/types"
import { Button } from "@/components/ui/button"

const notificationIcons: Record<NotificationType, React.ElementType> = {
  booking: Package,
  invoice: FileText,
  task: CheckCircle,
  incident: AlertCircle,
  system: Bell,
}

// Get navigation URL based on notification type
function getNavigationUrl(type: NotificationType): string {
  switch (type) {
    case 'booking':
      return '/dashboard/bookings'
    case 'invoice':
      return '/dashboard/invoices'
    case 'task':
      return '/warehouse/tasks'
    case 'incident':
      return '/dashboard/claims'
    case 'system':
    default:
      return '/dashboard/notifications'
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { notifications, unreadCount, markAsRead } = useRealtimeNotifications(user?.id || "")

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !n.read)
  }, [notifications])

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    
    // Navigate to the relevant page
    const url = getNavigationUrl(notification.type)
    router.push(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Manage your alerts and preferences"
      />

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            All
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>Your latest alerts and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type]
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex items-start gap-4 p-4 rounded-lg transition-colors cursor-pointer hover:bg-accent ${
                        notification.read ? "bg-muted/30" : "bg-primary/5 border border-primary/20"
                      }`}
                    >
                      <div className={`rounded-full p-2 ${notification.read ? "bg-muted" : "bg-primary/10"}`}>
                        <Icon className={`h-4 w-4 ${notification.read ? "text-muted-foreground" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${notification.read ? "" : "text-primary"}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDate(notification.createdAt)}</span>
                            {notification.read ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <div className="h-2 w-2 bg-primary rounded-full" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread">
          <Card>
            <CardHeader>
              <CardTitle>Unread Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {unreadNotifications.length > 0 ? (
                <div className="space-y-4">
                  {unreadNotifications.map((notification) => {
                      const Icon = notificationIcons[notification.type]
                      return (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover:bg-accent transition-colors"
                        >
                          <div className="rounded-full p-2 bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-primary">{notification.title}</p>
                              <div className="h-2 w-2 bg-primary rounded-full" />
                            </div>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                  <p className="text-muted-foreground">All caught up!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Notification Preferences</CardTitle>
              </div>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-4">Channels</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Push Notifications</p>
                        <p className="text-sm text-muted-foreground">Browser and mobile</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-4">Notification Types</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="booking-notifs">Booking Updates</Label>
                    <Switch id="booking-notifs" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="invoice-notifs">Invoice & Payment Reminders</Label>
                    <Switch id="invoice-notifs" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="incident-notifs">Incident Alerts</Label>
                    <Switch id="incident-notifs" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="promo-notifs">Promotions & Offers</Label>
                    <Switch id="promo-notifs" />
                  </div>
                </div>
              </div>
              <Button>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
