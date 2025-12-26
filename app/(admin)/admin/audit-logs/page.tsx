"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2, Search, FileText } from "@/components/icons"
import { formatDateTime } from "@/lib/utils/format"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import type { AuditLog } from "@/lib/audit/types"

interface Company {
  id: string
  name: string
}

export default function AuditLogsPage() {
  const { user } = useUser()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all")
  const [isRoot, setIsRoot] = useState(false)

  useEffect(() => {
    checkUserRole()
    fetchCompanies()
  }, [user])

  useEffect(() => {
    if (isRoot) {
      fetchAuditLogs()
    }
  }, [selectedCompanyId, isRoot])

  const checkUserRole = async () => {
    if (!user) return
    
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    if (profile?.role === 'root') {
      setIsRoot(true)
    } else {
      setIsRoot(false)
      setLoading(false)
    }
  }

  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true)
      const response = await fetch("/api/v1/companies")
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setLoadingCompanies(false)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCompanyId && selectedCompanyId !== 'all') {
        params.append('companyId', selectedCompanyId)
      }
      params.append('limit', '200')

      const response = await fetch(`/api/v1/audit-logs?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAuditLogs(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionDescription = (log: AuditLog): string => {
    const actionMap: Record<string, string> = {
      create: 'Created',
      update: 'Updated',
      delete: 'Deleted',
      view: 'Viewed',
      login: 'Logged in',
      logout: 'Logged out',
      export: 'Exported',
      import: 'Imported',
      approve: 'Approved',
      reject: 'Rejected',
      assign: 'Assigned',
      complete: 'Completed',
    }

    return actionMap[log.action] || log.action
  }

  const getActionColor = (action: string): string => {
    const colorMap: Record<string, string> = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      view: 'bg-gray-100 text-gray-800',
      login: 'bg-green-100 text-green-800',
      logout: 'bg-gray-100 text-gray-800',
      approve: 'bg-green-100 text-green-800',
      reject: 'bg-red-100 text-red-800',
    }
    return colorMap[action] || 'bg-gray-100 text-gray-800'
  }

  const parseUserAgent = (userAgent?: string): string => {
    if (!userAgent) return "-"
    
    // Simple browser detection
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    if (userAgent.includes('Opera')) return 'Opera'
    
    return userAgent.substring(0, 50) + (userAgent.length > 50 ? '...' : '')
  }

  const filteredLogs = auditLogs.filter((log) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      log.userName.toLowerCase().includes(searchLower) ||
      log.userEmail.toLowerCase().includes(searchLower) ||
      getActionDescription(log).toLowerCase().includes(searchLower) ||
      log.entity.toLowerCase().includes(searchLower) ||
      log.entityId.toLowerCase().includes(searchLower) ||
      log.ipAddress?.toLowerCase().includes(searchLower)
    )
  })

  if (!isRoot) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only root users can access audit logs.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="System-wide audit trail of all user actions"
      >
        <FileText className="h-5 w-5" />
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>
                Complete audit trail of all system operations, errors, and user actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {!loadingCompanies && (
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, entity, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {search ? "No results found" : "No audit logs found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.userName}</p>
                              <p className="text-sm text-muted-foreground">{log.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionColor(log.action)}>
                              {getActionDescription(log)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.entity}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">
                              {log.entityId.substring(0, 8)}...
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {log.ipAddress || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {parseUserAgent(log.userAgent)}
                            </span>
                          </TableCell>
                          <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

