"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Mail, Phone, LogOut, Bell, Moon, Loader2 } from "@/components/icons"

export default function ProfilePage() {
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [user, setUser] = useState<{ name: string; email: string; phone?: string } | null>(null)
  const [stats, setStats] = useState({ hours: 0, tasks: 0, onTime: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      // Fetch user profile
      const userRes = await fetch('/api/v1/users/me')
      if (userRes.ok) {
        const userData = await userRes.json()
        setUser(userData.data)
      }

      // Fetch warehouse staff stats (tasks completed this week, hours, etc.)
      const tasksRes = await fetch('/api/v1/tasks')
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const completedTasks = (tasksData.data || []).filter((t: any) => t.status === 'completed')
        setStats({
          hours: 42, // Would come from warehouse_staff shifts API
          tasks: completedTasks.length,
          onTime: 96, // Would be calculated
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">MW</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user?.name || 'Warehouse Staff'}</h2>
              <p className="text-muted-foreground">Warehouse Associate</p>
              <Badge variant="secondary" className="mt-1">
                Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{user?.email || '-'}</span>
          </div>
          {user?.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{user.phone}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{stats.hours}h</p>
              <p className="text-xs text-muted-foreground">Hours</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{stats.tasks}</p>
              <p className="text-xs text-muted-foreground">Tasks</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.onTime}%</p>
              <p className="text-xs text-muted-foreground">On-Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="notifications">Push Notifications</Label>
            </div>
            <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="darkMode">Dark Mode</Label>
            </div>
            <Switch id="darkMode" checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button variant="outline" className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent">
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  )
}
