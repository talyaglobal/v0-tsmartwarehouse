"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Search, Filter, Eye, Download, RefreshCw } from "lucide-react"
import type { AuditLog } from "@/types"

// Mock audit log data
const mockAuditLogs: AuditLog[] = [
  {
    id: "1",
    user_id: "usr-001",
    action: "booking.created",
    entity_type: "booking",
    entity_id: "bk-001",
    old_values: undefined,
    new_values: { status: "pending", customer_id: "cust-001" },
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0...",
    created_at: "2025-01-15T10:30:00Z",
  },
  {
    id: "2",
    user_id: "usr-002",
    action: "booking.confirmed",
    entity_type: "booking",
    entity_id: "bk-001",
    old_values: { status: "pending" },
    new_values: { status: "confirmed" },
    ip_address: "192.168.1.101",
    user_agent: "Mozilla/5.0...",
    created_at: "2025-01-15T11:15:00Z",
  },
  {
    id: "3",
    user_id: "usr-001",
    action: "payment.received",
    entity_type: "payment",
    entity_id: "pay-001",
    old_values: undefined,
    new_values: { amount: 5000, method: "credit_card" },
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0...",
    created_at: "2025-01-15T14:00:00Z",
  },
  {
    id: "4",
    user_id: "usr-003",
    action: "incident.reported",
    entity_type: "incident",
    entity_id: "inc-001",
    old_values: undefined,
    new_values: { severity: "high", type: "damage" },
    ip_address: "192.168.1.102",
    user_agent: "Mozilla/5.0...",
    created_at: "2025-01-15T15:30:00Z",
  },
  {
    id: "5",
    user_id: "usr-002",
    action: "user.updated",
    entity_type: "user",
    entity_id: "usr-004",
    old_values: { role: "worker" },
    new_values: { role: "admin" },
    ip_address: "192.168.1.101",
    user_agent: "Mozilla/5.0...",
    created_at: "2025-01-15T16:45:00Z",
  },
]

const actionColors: Record<string, string> = {
  created: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  updated: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  reported: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
}

function getActionColor(action: string): string {
  const actionType = action.split(".")[1] || action
  return actionColors[actionType] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

export function AuditLogViewer() {
  const [logs] = useState<AuditLog[]>(mockAuditLogs)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEntity, setFilterEntity] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEntity = filterEntity === "all" || log.entity_type === filterEntity
    return matchesSearch && matchesEntity
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Track all system changes and user actions</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by action, entity, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="booking">Bookings</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
              <SelectItem value="incident">Incidents</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="hidden md:table-cell">User</TableHead>
                <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                <TableHead className="w-[50px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{formatTimestamp(log.created_at)}</TableCell>
                  <TableCell>
                    <Badge className={getActionColor(log.action)} variant="secondary">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{log.entity_id}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="font-mono text-xs">{log.user_id}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="font-mono text-xs">{log.ip_address}</span>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View details</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Audit Log Details</DialogTitle>
                          <DialogDescription>Full details of the logged action</DialogDescription>
                        </DialogHeader>
                        {selectedLog && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Action</label>
                                <p className="font-mono">{selectedLog.action}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                                <p>{new Date(selectedLog.created_at).toLocaleString()}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Entity Type</label>
                                <p className="capitalize">{selectedLog.entity_type}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Entity ID</label>
                                <p className="font-mono">{selectedLog.entity_id}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">User ID</label>
                                <p className="font-mono">{selectedLog.user_id}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                                <p className="font-mono">{selectedLog.ip_address}</p>
                              </div>
                            </div>
                            {selectedLog.old_values && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Previous Values</label>
                                <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto">
                                  {JSON.stringify(selectedLog.old_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {selectedLog.new_values && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">New Values</label>
                                <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto">
                                  {JSON.stringify(selectedLog.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">No audit logs found matching your criteria</div>
        )}
      </CardContent>
    </Card>
  )
}
