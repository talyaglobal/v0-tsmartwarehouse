"use client"
import { WorkerHeader } from "@/components/worker/worker-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { mockWorkers, mockWarehouses } from "@/lib/mock-data"
import { getInitials } from "@/lib/utils/format"
import { Mail, Phone, Building2, Clock, Award, Bell, Moon, LogOut, Shield } from "lucide-react"

export default function ProfilePage() {
  const worker = mockWorkers[0]
  const warehouse = mockWarehouses.find((w) => w.id === worker.warehouse_id)

  return (
    <div className="flex flex-col min-h-screen">
      <WorkerHeader title="Profile" />

      <main className="flex-1 p-4 space-y-4">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6 text-center">
            <Avatar className="h-20 w-20 mx-auto mb-4">
              <AvatarImage src="/worker-portrait.jpg" />
              <AvatarFallback className="text-xl">{getInitials(worker.full_name)}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-semibold">{worker.full_name}</h2>
            <p className="text-muted-foreground">{worker.employee_id}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  worker.is_available ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                }`}
              >
                {worker.is_available ? "Available" : "Busy"}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium capitalize">
                {worker.shift} Shift
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{worker.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{worker.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{warehouse?.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm capitalize">{worker.department}</span>
            </div>
          </CardContent>
        </Card>

        {/* Skills & Certifications */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              Skills & Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {worker.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {worker.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-700 px-2 py-1 text-xs"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      {cert}
                    </span>
                  ))}
                </div>
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
                <span className="text-sm">Push Notifications</span>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Dark Mode</span>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-12 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </main>
    </div>
  )
}
