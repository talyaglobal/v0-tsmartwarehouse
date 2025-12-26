'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { PalletLabel } from '@/components/inventory/pallet-label'
import { api } from '@/lib/api/client'
import { Loader2, Printer } from 'lucide-react'
import type { PalletLabelData } from '@/types'

export default function PalletLabelPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolvedParams = use(Promise.resolve(params))
  const inventoryItemId = resolvedParams.id

  const { data: labelData, isLoading } = useQuery({
    queryKey: ['pallet-label', inventoryItemId],
    queryFn: async () => {
      const result = await api.get<PalletLabelData>(
        `/api/v1/inventory/${inventoryItemId}/label`,
        { showToast: false }
      )
      if (!result.success || !result.data) {
        throw new Error('Failed to load label data')
      }
      return result.data
    },
  })

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/v1/inventory/${inventoryItemId}/label?format=pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pallet-label-${inventoryItemId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!labelData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pallet Label" description="View and print pallet label" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Label data not found
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pallet Label"
        description="View and print pallet label with full traceability"
      />

      <div className="flex gap-2 justify-end">
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline">
          Download PDF
        </Button>
      </div>

      <div className="max-w-2xl mx-auto">
        <PalletLabel labelData={labelData} printMode />
      </div>
    </div>
  )
}

