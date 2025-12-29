"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Package, DollarSign, FileText, ArrowRight, Building2, Loader2, AlertCircle, Calendar } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Booking, Invoice, Claim } from "@/types"
import { api } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"

export default function CustomerDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [user, setUser] = useState<{ membershipTier?: string; creditBalance?: number } | null>(null)
  const [userRole, setUserRole] = useState<string>('customer')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Get user role first
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle()

        if (profile?.role) {
          setUserRole(profile.role)
        }
      }

      const [bookingsData, invoicesData, claimsData, userData] = await Promise.all([
        api.get('/api/v1/bookings', { showToast: false }),
        api.get('/api/v1/invoices', { showToast: false }).catch(() => ({ success: false, data: [] })),
        api.get('/api/v1/claims', { showToast: false }).catch(() => ({ success: false, data: [] })),
        api.get('/api/v1/users/me', { showToast: false }).catch(() => ({ success: false, data: null })),
      ])

      if (bookingsData.success) {
        setBookings(bookingsData.data || [])
      }

      if (invoicesData.success) {
        setInvoices(invoicesData.data || [])
      }

      if (claimsData.success) {
        setClaims(claimsData.data || [])
      }

      if (userData.success && userData.data) {
        setUser(userData.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeBookings = bookings.filter((b) => b.status === "active" || b.status === "confirmed")
  const pendingInvoices = invoices.filter((i) => i.status === "pending")
  const membershipTier = user?.membershipTier || "bronze"
  const creditBalance = user?.creditBalance || 0
  const recentClaims = claims.filter((c) => c.status === "submitted" || c.status === "under-review")
  const isCustomer = userRole === 'customer'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Welcome back, Sarah. Here's an overview of your warehouse activity.">
        <Link href="/dashboard/bookings/new">
          <Button>New Booking</Button>
        </Link>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Bookings"
          value={activeBookings.length}
          icon={Package}
          trend={{ value: 12, isPositive: true }}
          subtitle="from last month"
        />
        <StatCard
          title="Total Bookings"
          value={bookings.length}
          icon={Package}
          subtitle="all time"
        />
        {isCustomer ? (
          <>
            <StatCard
              title="Active Claims"
              value={recentClaims.length}
              icon={AlertCircle}
              subtitle="pending review"
            />
            <StatCard
              title="Upcoming Events"
              value={0}
              icon={Calendar}
              subtitle="this month"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Pending Invoices"
              value={pendingInvoices.length}
              icon={FileText}
              subtitle={formatCurrency(pendingInvoices.reduce((sum, i) => sum + i.total, 0))}
            />
            <StatCard
              title="Membership Credits"
              value={formatCurrency(creditBalance)}
              icon={DollarSign}
              trend={{ value: 5, isPositive: true }}
              subtitle={`${membershipTier.charAt(0).toUpperCase() + membershipTier.slice(1)} tier benefits`}
            />
          </>
        )}
      </div>

      {/* Recent Bookings & Invoices */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Your latest warehouse bookings</CardDescription>
            </div>
            <Link href="/dashboard/bookings">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      {booking.type === "pallet" ? (
                        <Package className="h-5 w-5 text-primary" />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {booking.type === "pallet"
                          ? `${booking.palletCount} Pallets`
                          : `${booking.areaSqFt?.toLocaleString()} sq ft Area`}
                      </p>
                      <p className="text-sm text-muted-foreground">{formatDate(booking.startDate)}</p>
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices or Claims based on role */}
        {isCustomer ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Claims</CardTitle>
                <CardDescription>Your submitted claims</CardDescription>
              </div>
              <Link href="/dashboard/claims">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {claims.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No claims yet</p>
                  </div>
                ) : (
                  claims.slice(0, 3).map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <AlertCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{claim.type}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(claim.amount)}</p>
                        </div>
                      </div>
                      <StatusBadge status={claim.status} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Invoices</CardTitle>
                <CardDescription>Your billing history</CardDescription>
              </div>
              <Link href="/dashboard/invoices">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.slice(0, 3).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Invoice #{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">Due {formatDate(invoice.dueDate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(invoice.total)}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Membership Card - Only for company staff */}
      {!isCustomer && (
        <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <Badge variant="secondary" className="mb-2">
                {membershipTier.charAt(0).toUpperCase() + membershipTier.slice(1)} Member
              </Badge>
              <h3 className="text-xl font-bold">
                {membershipTier === 'platinum' ? '15%' : membershipTier === 'gold' ? '10%' : membershipTier === 'silver' ? '5%' : '0%'} Discount on All Services
              </h3>
              <p className="text-amber-100 mt-1">You have {formatCurrency(creditBalance)} in loyalty credits available</p>
            </div>
            <Link href="/dashboard/membership">
              <Button variant="secondary">View Benefits</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
