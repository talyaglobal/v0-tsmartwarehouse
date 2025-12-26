import { redirect } from 'next/navigation'
import { OrderDetails } from '@/components/dashboard/order-details'
import { fetchServiceOrderById } from '@/features/orders/lib/queries'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const order = await fetchServiceOrderById(params.id)

  if (!order) {
    redirect('/dashboard/orders')
  }

  // Verify user owns this order
  if (order.customerId !== user.id) {
    redirect('/dashboard/orders')
  }

  return <OrderDetails order={order} />
}

