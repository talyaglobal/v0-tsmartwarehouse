"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Plus, Loader2, LogOut } from "@/components/icons"
import { formatDateTime } from "@/lib/utils/format"
import type { AccessLog, AccessLogVisitorType } from "@/types"

import type { LucideIcon } from "lucide-react"

interface AccessLogsListProps {
  visitorType: AccessLogVisitorType
  title: string
  description: string
  icon: LucideIcon
}

export function AccessLogsList({ visitorType, title, description, icon: Icon }: AccessLogsListProps) {
  const [search, setSearch] = useState("")
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null)

  useEffect(() => {
    fetchAccessLogs()
  }, [])

  const fetchAccessLogs = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/access-logs?visitorType=${visitorType}`)
      if (response.ok) {
        const data = await response.json()
        setAccessLogs(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch access logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async (log: AccessLog) => {
    setSelectedLog(log)
    setCheckOutDialogOpen(true)
  }

  const confirmCheckOut = async () => {
    if (!selectedLog) return

    try {
      const response = await fetch(`/api/v1/access-logs/${selectedLog.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitTime: new Date().toISOString() }),
      })

      if (response.ok) {
        await fetchAccessLogs()
        setCheckOutDialogOpen(false)
        setSelectedLog(null)
      }
    } catch (error) {
      console.error('Failed to check out:', error)
    }
  }

  const filteredLogs = accessLogs.filter((log) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      log.personName.toLowerCase().includes(searchLower) ||
      log.vehicleLicensePlate?.toLowerCase().includes(searchLower) ||
      log.personIdNumber?.toLowerCase().includes(searchLower) ||
      log.companyName?.toLowerCase().includes(searchLower)
    )
  })

  const checkedInCount = accessLogs.filter((log) => log.status === "checked_in").length
  const checkedOutToday = accessLogs.filter(
    (log) => log.status === "checked_out" && log.exitTime && new Date(log.exitTime).toDateString() === new Date().toDateString()
  ).length
  const totalToday = accessLogs.filter(
    (log) => new Date(log.entryTime).toDateString() === new Date().toDateString()
  ).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showVehicleColumns = visitorType === 'vehicle' || visitorType === 'delivery_driver'

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description}>
        <Button onClick={() => {/* TODO: Open check-in form */}}>
          <Plus className="mr-2 h-4 w-4" />
          Check In
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Checked In"
          value={checkedInCount.toString()}
          icon={Icon}
          subtitle="Currently on premises"
        />
        <StatCard
          title="Checked Out Today"
          value={checkedOutToday.toString()}
          icon={Icon}
          subtitle="Exited today"
        />
        <StatCard
          title="Total Today"
          value={totalToday.toString()}
          icon={Icon}
          subtitle="All entries today"
        />
        <StatCard
          title="Total Records"
          value={accessLogs.length.toString()}
          icon={Icon}
          subtitle="All time"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, license plate, ID..."
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
                <TableHead>Name</TableHead>
                {showVehicleColumns && <TableHead>Vehicle</TableHead>}
                <TableHead>Company</TableHead>
                <TableHead>Entry Time</TableHead>
                <TableHead>Exit Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showVehicleColumns ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No access logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.personName}</p>
                        {log.personEmail && (
                          <p className="text-sm text-muted-foreground">{log.personEmail}</p>
                        )}
                      </div>
                    </TableCell>
                    {showVehicleColumns && (
                      <TableCell>
                        {log.vehicleLicensePlate ? (
                          <div>
                            <p className="font-medium">{log.vehicleLicensePlate}</p>
                            {log.vehicleMake && log.vehicleModel && (
                              <p className="text-sm text-muted-foreground">
                                {log.vehicleMake} {log.vehicleModel}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>{log.companyName || "-"}</TableCell>
                    <TableCell>{formatDateTime(log.entryTime)}</TableCell>
                    <TableCell>{log.exitTime ? formatDateTime(log.exitTime) : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "checked_in" ? "default" : "secondary"}>
                        {log.status === "checked_in" ? "Checked In" : "Checked Out"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.purpose || "-"}</TableCell>
                    <TableCell>
                      {log.status === "checked_in" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckOut(log)}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Check Out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={checkOutDialogOpen} onOpenChange={setCheckOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Visitor</DialogTitle>
            <DialogDescription>
              Confirm checkout for {selectedLog?.personName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Entry time: {selectedLog && formatDateTime(selectedLog.entryTime)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckOutDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCheckOut}>
              Confirm Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

