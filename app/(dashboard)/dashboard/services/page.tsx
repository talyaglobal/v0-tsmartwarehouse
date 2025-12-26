import { ServicesListPage } from '@/components/dashboard/services-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ShoppingCart } from '@/components/icons'
import Link from 'next/link'

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Services"
        description="Browse and order value-added warehouse services for your storage needs"
      >
        <Link href="/dashboard/orders/new">
          <Button>
            <ShoppingCart className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </Link>
      </PageHeader>

      <ServicesListPage />
    </div>
  )
}

