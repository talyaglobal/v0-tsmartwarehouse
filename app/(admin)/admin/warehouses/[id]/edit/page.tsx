"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "@/components/icons"

export default function AdminWarehouseEditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard warehouse edit page
    router.replace(`/dashboard/warehouses/${resolvedParams.id}/edit`)
  }, [resolvedParams.id, router])

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Redirecting...</span>
    </div>
  )
}
