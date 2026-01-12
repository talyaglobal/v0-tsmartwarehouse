"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/ui/page-header"
import { 
  Search, Edit, Loader2, ArrowLeft,
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

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any; description: string }> = {
  root: { 
    label: "Root Admin", 
    color: "bg-red-100 text-red-700 border-red-200", 
    icon: Shield,
    description: "Full system access with all administrative privileges"
  },
  "warehouse-admin": { 
    label: "Warehouse Admin", 
    color: "bg-emerald-100 text-emerald-700 border-emerald-200", 
    icon: Building2,
    description: "Warehouse owners with full warehouse management access"
  },
  "warehouse-supervisor": { 
    label: "Warehouse Supervisor", 
    color: "bg-blue-100 text-blue-700 border-blue-200", 
    icon: UserCheck,
    description: "Supervisors managing bookings and services"
  },
  "warehouse-client": { 
    label: "Warehouse Client", 
    color: "bg-violet-100 text-violet-700 border-violet-200", 
    icon: User,
    description: "Customers renting warehouse space"
  },
  "warehouse-staff": { 
    label: "Warehouse Staff", 
    color: "bg-slate-100 text-slate-700 border-slate-200", 
    icon: ClipboardList,
    description: "Staff handling warehouse operations and tasks"
  },
  "warehouse-finder": { 
    label: "Warehouse Finder", 
    color: "bg-amber-100 text-amber-700 border-amber-200", 
    icon: BarChart3,
    description: "Users who find and onboard new warehouses"
  },
  "warehouse-broker": { 
    label: "Warehouse Broker", 
    color: "bg-indigo-100 text-indigo-700 border-indigo-200", 
    icon: DollarSign,
    description: "Brokers connecting clients with warehouses"
  },
  "end-delivery-party": { 
    label: "End Delivery Party", 
    color: "bg-orange-100 text-orange-700 border-orange-200", 
    icon: Truck,
    description: "Companies receiving products from warehouses"
  },
  "local-transport": { 
    label: "Local Transport", 
    color: "bg-lime-100 text-lime-700 border-lime-200", 
    icon: Car,
    description: "Local transportation companies"
  },
  "international-transport": { 
    label: "International Transport", 
    color: "bg-cyan-100 text-cyan-700 border-cyan-200", 
    icon: Truck,
    description: "International shipping and logistics companies"
  },
}

export default function RoleUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const roleSlug = resolvedParams.slug
  const roleKey = roleSlug.replace(/-/g, "_")
  const roleConfig = ROLE_CONFIG[roleSlug] || { label: roleSlug, color: "bg-gray-100", icon: User, description: "" }
  const Icon = roleConfig.icon

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("role", roleKey)
      if (search) params.append("search", search)

      const response = await fetch(`/api/v1/admin/users?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [roleKey])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={roleConfig.label}
          description={roleConfig.description}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${roleConfig.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{users.length} {roleConfig.label}s</CardTitle>
                <CardDescription>Manage users with this role</CardDescription>
              </div>
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
                  <TableHead>Company</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No {roleConfig.label.toLowerCase()}s found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || "—"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
