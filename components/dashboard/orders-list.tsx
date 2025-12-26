'use client'

import { useQuery } from '@tanstack/react-query'
import { OrdersListClient } from '@/features/orders/components/orders-list-client'
import { useUser } from '@/lib/hooks/use-user'
import { api } from '@/lib/api/client'
import { Loader2 } from '@/components/icons'
import type { ServiceOrder } from '@/types'

export function OrdersListPage() {
  const { user, isLoading: userLoading } = useUser()

  // React Query: Fetch service orders
  const {
    data: orders = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['service-orders', user?.id],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<ServiceOrder[]>('/api/v1/service-orders', { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Failed to load orders. Please try again.</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please log in to view your orders.</p>
      </div>
    )
  }

  return <OrdersListClient orders={orders} />
}

