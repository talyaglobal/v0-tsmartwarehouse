"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/ui/page-header"
import { 
  Users, Search, Edit, Loader2, 
  Shield, Building2, UserCheck, User, ClipboardList,
  BarChart3, DollarSign, Truck, Car, RefreshCw
} from "@/components/icons"
import { formatDistanceToNow } from "date-fns"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string
  company_id: string | null
  company_name: string | null
  created_at: string
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  root: { label: "Root Admin", color: "bg-red-100 text-red-700 border-red-200", icon: Shield },
  warehouse_admin: { label: "Warehouse Admin", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Building2 },
  warehouse_supervisor: { label: "Warehouse Supervisor", color: "bg-blue-100 text-blue-700 border-blue-200", icon: UserCheck },
  warehouse_client: { label: "Warehouse Client", color: "bg-violet-100 text-violet-700 border-violet-200", icon: User },
  warehouse_staff: { label: "Warehouse Staff", color: "bg-slate-100 text-slate-700 border-slate-200", icon: ClipboardList },
  warehouse_finder: { label: "Warehouse Finder", color: "bg-amber-100 text-amber-700 border-amber-200", icon: BarChart3 },
  warehouse_broker: { label: "Warehouse Broker", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: DollarSign },
  end_delivery_party: { label: "End Delivery Party", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Truck },
  local_transport: { label: "Local Transport", color: "bg-lime-100 text-lime-700 border-lime-200", icon: Car },
  international_transport: { label: "Intl. Transport", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Truck },
}

export default function AllUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({})

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (roleFilter !== "all") params.append("role", roleFilter)

      const response = await fetch(`/api/v1/admin/users?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.data)
        setRoleCounts(data.roleCounts || {})
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [roleFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers()
  }

  const totalUsers = Object.values(roleCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Users"
        description={`Manage all ${totalUsers} users across all roles`}
      />

      {/* Role Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5 lg:grid-cols-10">
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const count = roleCounts[role] || 0
          const Icon = config.icon
          return (
            <Link key={role} href={`/admin/users/by-role/${role.replace(/_/g, "-")}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="p-3 text-center">
                  <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{config.label}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>View and manage all system users</CardDescription>
            </div>
            <Button onClick={fetchUsers} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <SelectItem key={role} value={role}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Search</Button>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const roleConfig = ROLE_CONFIG[user.role] || { label: user.role, color: "bg-gray-100 text-gray-700 border-gray-200" }
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${roleConfig.color} border`}>
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.company_name || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/users/${user.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
