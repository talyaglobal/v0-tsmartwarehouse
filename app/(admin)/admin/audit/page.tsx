import { PageHeader } from "@/components/ui/page-header"
import { AuditLogViewer } from "@/components/admin/audit-log-viewer"

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Complete history of system changes and user actions for compliance and troubleshooting"
      />
      <AuditLogViewer />
    </div>
  )
}
