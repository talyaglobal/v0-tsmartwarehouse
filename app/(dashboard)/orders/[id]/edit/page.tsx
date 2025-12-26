import { redirect } from 'next/navigation'
import { OrderForm } from '@/components/dashboard/order-form'
import { fetchServiceOrderById } from '@/features/orders/lib/queries'
import { fetchServices } from '@/features/services/lib/queries'
import { getBookings } from '@/lib/db/bookings'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function EditOrderPage({
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

  // Fetch order
  const order = await fetchServiceOrderById(params.id)

  if (!order) {
    redirect('/dashboard/orders')
  }

  // Verify user owns this order
  if (order.customerId !== user.id) {
    redirect('/dashboard/orders')
  }

  // Only allow editing draft/pending orders
  if (!['draft', 'pending'].includes(order.status)) {
    redirect(`/dashboard/orders/${order.id}`)
  }

  // Fetch services and active bookings
  const [services, bookings] = await Promise.all([
    fetchServices({ isActive: true }),
    getBookings({ customerId: user.id, status: 'active' }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Service Order</h1>
        <p className="text-muted-foreground mt-2">
          Update order details and items
        </p>
      </div>

      <OrderForm
        services={services}
        order={order}
        bookings={bookings.map((b) => ({
          id: b.id,
          type: b.type,
          palletCount: b.palletCount,
        }))}
      />
    </div>
  )
}

