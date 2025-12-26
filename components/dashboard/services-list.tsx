import { Suspense } from 'react'
import { DefaultLoadingFallback } from '@/lib/server/suspense-boundary'
import { ServicesList } from '@/features/services/components/services-list'
import { fetchServices } from '@/features/services/lib/queries'

async function ServicesListData() {
  const services = await fetchServices({ isActive: true })
  return <ServicesList services={services} />
}

export function ServicesListPage() {
  return (
    <Suspense fallback={<DefaultLoadingFallback />}>
      <ServicesListData />
    </Suspense>
  )
}

