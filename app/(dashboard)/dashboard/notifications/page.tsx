"use client"

import { useMemo } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Bell, Package, FileText, AlertCircle, CheckCircle, Mail, Smartphone, Settings, Wifi, WifiOff } from "@/components/icons"
import { useRealtimeNotifications } from "@/lib/realtime"
import { useUser } from "@/lib/hooks/use-user"
import { formatDate } from "@/lib/utils/format"

const notificationIcons = {
  booking: Package,
  invoice: FileText,
  task: CheckCircle,
  incident: AlertCircle,
  system: Bell,
}

export default function NotificationsPage() {
  const { user } = useUser()
  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead } = useRealtimeNotifications(user?.id || "")

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !n.read)
  }, [notifications])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          <div className="flex items-center gap-2">
            <span>Manage your alerts and preferences</span>
            {isConnected ? (
              <span title="Real-time connected">
                <Wifi className="h-4 w-4 text-green-500" />
              </span>
            ) : (
              <span title="Real-time disconnected">
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
          </div>
        }
      >
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        )}
      </PageHeader>

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
                      className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
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
                          <span className="text-xs text-muted-foreground">{formatDate(notification.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                      {!notification.read && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                          Mark Read
                        </Button>
                      )}
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
                          className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20"
                        >
                          <div className="rounded-full p-2 bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium text-primary">{notification.title}</p>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                            Mark Read
                          </Button>
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
                        <p className="text-sm text-muted-foreground">customer@example.com</p>
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
