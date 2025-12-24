'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { acceptInvitation } from '@/features/companies/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AcceptInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      handleAccept()
    }
  }, [token])

  async function handleAccept() {
    try {
      const result = await acceptInvitation(token)

      if (result.success) {
        setStatus('success')
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setStatus('error')
        setError(result.error || 'Failed to accept invitation')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Processing invitation...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-sm text-center">
                Invitation accepted successfully! Redirecting to dashboard...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <XCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-center text-red-500">{error}</p>
              <Button onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

