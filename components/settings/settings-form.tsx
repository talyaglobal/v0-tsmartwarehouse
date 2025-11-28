"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateProfile } from "@/lib/supabase/auth"
import { CheckCircle2 } from "@/components/icons"
import type { Profile } from "@/types/database"

interface SettingsFormProps {
  profile: Profile | null
  email: string
}

export function SettingsForm({ profile, email }: SettingsFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    notify_via_email: profile?.notify_via_email ?? true,
    notify_via_whatsapp: profile?.notify_via_whatsapp ?? false,
    whatsapp_number: profile?.whatsapp_number || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccess(false)

    const { error } = await updateProfile(formData)

    if (!error) {
      setSuccess(true)
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <Alert className="bg-accent/10 border-accent">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          <AlertDescription className="text-accent">Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_email">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive booking and payment notifications via email</p>
            </div>
            <Switch
              id="notify_email"
              checked={formData.notify_via_email}
              onCheckedChange={(checked) => setFormData({ ...formData, notify_via_email: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_whatsapp">WhatsApp Notifications</Label>
              <p className="text-sm text-muted-foreground">Get updates on WhatsApp</p>
            </div>
            <Switch
              id="notify_whatsapp"
              checked={formData.notify_via_whatsapp}
              onCheckedChange={(checked) => setFormData({ ...formData, notify_via_whatsapp: checked })}
            />
          </div>
          {formData.notify_via_whatsapp && (
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
              <Input
                id="whatsapp_number"
                type="tel"
                placeholder="+1234567890"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  )
}
