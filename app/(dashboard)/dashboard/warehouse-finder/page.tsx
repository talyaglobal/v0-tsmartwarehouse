"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { 
  Building2, MapPin, Users, DollarSign, ArrowRight, Loader2, 
  Plus, TrendingUp, Calendar
} from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type { CRMContact } from "@/types"

export default function WarehouseFinderDashboardPage() {
  const [contacts, setContacts] = useState<CRMContact[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [stats, setStats] = useState({
    totalContacts: 0,
    activeLeads: 0,
    warehousesAdded: 0,
    totalCommission: 0,
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get user info
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle()
        
        if (profile?.name) {
          setUserName(profile.name)
        }
      }

      // Fetch contacts
      const contactsResult = await api.get<CRMContact[]>("/api/v1/crm/contacts?contact_type=warehouse_supplier", { showToast: false })
      if (contactsResult.success) {
        const contactsData = contactsResult.data || []
        setContacts(contactsData)
        
        // Calculate stats
        setStats({
          totalContacts: contactsData.length,
          activeLeads: contactsData.filter(c => c.status === 'active' || c.status === 'approved').length,
          warehousesAdded: contactsData.filter(c => c.status === 'converted').length,
          totalCommission: 0, // TODO: Calculate from actual commission data
        })
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouse Finder Dashboard</h1>
          <p className="text-muted-foreground">
            {userName ? `Welcome back, ${userName}. ` : ""}Find and add new warehouses to earn commissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/warehouse-finder/contacts">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={stats.totalContacts}
          icon={Users}
          subtitle="warehouse suppliers"
        />
        <StatCard
          title="Active Leads"
          value={stats.activeLeads}
          icon={TrendingUp}
          subtitle="in progress"
        />
        <StatCard
          title="Warehouses Added"
          value={stats.warehousesAdded}
          icon={Building2}
          subtitle="converted"
        />
        <StatCard
          title="Total Commission"
          value={formatCurrency(stats.totalCommission)}
          icon={DollarSign}
          subtitle="earned"
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for warehouse finders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/warehouse-finder/contacts" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Users className="h-4 w-4" />
                Manage Contacts
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link href="/dashboard/warehouse-finder/map" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <MapPin className="h-4 w-4" />
                View Map
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link href="/dashboard/warehouse-finder/visits" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Calendar className="h-4 w-4" />
                Schedule Visits
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link href="/dashboard/warehouse-finder/performance" className="block">
              <Button variant="outline" className="w-full justify-start gap-3">
                <TrendingUp className="h-4 w-4" />
                View Performance
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Contacts</CardTitle>
              <CardDescription>Your latest warehouse contacts</CardDescription>
            </div>
            <Link href="/dashboard/warehouse-finder/contacts">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No contacts yet</p>
                <Link href="/dashboard/warehouse-finder/contacts">
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Contact
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {contacts.slice(0, 5).map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{contact.contactName}</p>
                        <p className="text-sm text-muted-foreground">{contact.companyName || "No company"}</p>
                      </div>
                    </div>
                    <Badge variant={
                      contact.status === 'converted' ? 'default' :
                      contact.status === 'approved' ? 'secondary' :
                      'outline'
                    }>
                      {contact.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Info Card */}
      <Card className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <Badge variant="secondary" className="mb-2">
              Warehouse Finder Program
            </Badge>
            <h3 className="text-xl font-bold">
              Earn commission for every warehouse you add
            </h3>
            <p className="text-yellow-100 mt-1">
              Get a percentage of the monthly revenue from warehouses you bring to the platform
            </p>
          </div>
          <Link href="/dashboard/warehouse-finder/performance">
            <Button variant="secondary">View Earnings</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
