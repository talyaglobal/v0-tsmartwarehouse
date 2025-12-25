"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Users, Search, MoreHorizontal, Mail, Phone, Building2, Crown, Plus, Loader2 } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import type { MembershipTier, User } from "@/types"

const tierColors: Record<MembershipTier, string> = {
  bronze: "bg-orange-100 text-orange-800",
  silver: "bg-gray-100 text-gray-800",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-purple-100 text-purple-800",
}

type CustomerWithRole = User & { companyRole?: 'owner' | 'company_admin' | 'member' | null }

export default function CustomersPage() {
  const [search, setSearch] = useState("")
  const [customers, setCustomers] = useState<CustomerWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    goldMembers: 0,
    activeBookings: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // Note: This assumes a users API endpoint exists. If not, you'll need to create one.
      // For now, we'll fetch from Supabase directly or use a placeholder
      const response = await fetch('/api/v1/users?role=customer')
      if (response.ok) {
        const data = await response.json()
        setCustomers((data.data || []) as CustomerWithRole[])
        setStats({
          total: data.data?.length || 0,
          goldMembers: data.data?.filter((u: User) => u.membershipTier === 'gold' || u.membershipTier === 'platinum').length || 0,
          activeBookings: 0, // Would need to calculate from bookings
          totalRevenue: 0, // Would need to calculate from invoices
        })
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      // Fallback: empty array
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.companyName && c.companyName.toLowerCase().includes(search.toLowerCase())),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer accounts and memberships"
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Customers" value={stats.total.toString()} icon={Users} trend={{ value: 12, isPositive: true }} />
        <StatCard title="Gold Members" value={stats.goldMembers.toString()} icon={Crown} subtitle="Premium tier" />
        <StatCard title="Active Bookings" value={stats.activeBookings.toString()} icon={Building2} />
        <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Company Role</TableHead>
                <TableHead>Membership</TableHead>
                <TableHead>Credit Balance</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{customer.companyName || "-"}</TableCell>
                  <TableCell>
                    {customer.companyRole && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.companyRole === 'owner'
                            ? 'bg-purple-100 text-purple-800'
                            : customer.companyRole === 'company_admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {customer.companyRole === 'owner' && <Crown className="mr-1 h-3 w-3" />}
                        {customer.companyRole === 'company_admin' ? 'Company Admin' : customer.companyRole}
                      </span>
                    )}
                    {!customer.companyRole && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {customer.membershipTier && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${tierColors[customer.membershipTier]}`}
                      >
                        {customer.membershipTier}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{customer.creditBalance ? formatCurrency(customer.creditBalance) : "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Customer</DropdownMenuItem>
                        <DropdownMenuItem>View Bookings</DropdownMenuItem>
                        <DropdownMenuItem>Adjust Credits</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
