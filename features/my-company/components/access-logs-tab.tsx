"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/utils/format"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import type { AuditLog } from "@/lib/audit/types"

export function AccessLogsTab() {
  const { user } = useUser()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchCompanyId()
    }
  }, [user])

  useEffect(() => {
    if (companyId) {
      fetchAuditLogs()
    }
  }, [companyId])

  const fetchCompanyId = async () => {
    if (!user) return
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()
    
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }

  const fetchAuditLogs = async () => {
    if (!companyId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/audit-logs?companyId=${companyId}&limit=100`)
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
      create: 'oluşturdu',
      update: 'güncelledi',
      delete: 'sildi',
      view: 'görüntüledi',
      login: 'giriş yaptı',
      logout: 'çıkış yaptı',
      export: 'dışa aktardı',
      import: 'içe aktardı',
      approve: 'onayladı',
      reject: 'reddetti',
      assign: 'atadı',
      complete: 'tamamladı',
    }

    const entityMap: Record<string, string> = {
      booking: 'rezervasyon',
      invoice: 'fatura',
      claim: 'talep',
      incident: 'olay',
      task: 'görev',
      user: 'kullanıcı',
      warehouse: 'depo',
      system: 'sistem',
    }

    const action = actionMap[log.action] || log.action
    const entity = entityMap[log.entity] || log.entity

    return `${entity} ${action}`
  }

  const filteredLogs = auditLogs.filter((log) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      log.userName.toLowerCase().includes(searchLower) ||
      log.userEmail.toLowerCase().includes(searchLower) ||
      getActionDescription(log).toLowerCase().includes(searchLower) ||
      log.entityId.toLowerCase().includes(searchLower)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Access Logs</CardTitle>
          <CardDescription>
            Şirketinizde yapılan tüm işlemlerin kayıtları
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Kullanıcı, işlem veya ID ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>İşlem</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>IP Adresi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {search ? "Arama sonucu bulunamadı" : "Henüz işlem kaydı yok"}
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
                          <Badge variant="outline">
                            {getActionDescription(log)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.entity}</p>
                            <p className="text-xs text-muted-foreground">ID: {log.entityId.substring(0, 8)}...</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.ipAddress || "-"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

