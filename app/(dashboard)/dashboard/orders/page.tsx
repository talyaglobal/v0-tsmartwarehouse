"use client"

import { useState, useEffect } from 'react'
import { OrdersListPage } from '@/components/dashboard/orders-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Plus } from '@/components/icons'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function OrdersPage() {
  const [isCustomer, setIsCustomer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUserRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        
        // Only warehouse_client can create new orders
        setIsCustomer(profile?.role === 'warehouse_client')
      }
      setLoading(false)
    }
    
    checkUserRole()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Orders"
        description="Manage your warehouse service orders and track their status"
      >
        {!loading && isCustomer && (
          <Link href="/dashboard/orders/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </Link>
        )}
      </PageHeader>

      <OrdersListPage />
    </div>
  )
}
