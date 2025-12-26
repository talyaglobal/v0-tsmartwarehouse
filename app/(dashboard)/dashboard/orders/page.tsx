import { OrdersListPage } from '@/components/dashboard/orders-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Plus } from '@/components/icons'
import Link from 'next/link'

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Orders"
        description="Manage your warehouse service orders and track their status"
      >
        <Link href="/dashboard/orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </Link>
      </PageHeader>

      <OrdersListPage />
    </div>
  )
}

