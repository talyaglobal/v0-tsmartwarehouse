"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useUser } from '@/lib/hooks/use-user'

export function PlatformAuthButtons() {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
      </div>
    )
  }

  if (user) {
    return (
      <Link href="/dashboard">
        <Button variant="ghost">Dashboard</Button>
      </Link>
    )
  }

  return (
    <>
      <Link href="/login">
        <Button variant="ghost">Sign In</Button>
      </Link>
      <Link href="/register">
        <Button>Get Started</Button>
      </Link>
    </>
  )
}

