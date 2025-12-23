"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "@/components/icons"
import { requestPasswordReset } from "@/lib/auth/actions"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.append('email', email)

    const result = await requestPasswordReset(formData)
    
    if (result?.error) {
      setError(result.error.message)
      setIsLoading(false)
    } else {
      setSuccess(true)
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>We've sent you a password reset link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 text-sm bg-muted rounded-md">
            <p className="mb-2">
              If an account with the email <strong>{email}</strong> exists, you will receive a password reset link.
            </p>
            <p className="mb-2">
              Please check your inbox and click the link to reset your password.
            </p>
            <p className="text-xs text-muted-foreground">
              The link will expire in 24 hours. If you don't see the email, check your spam folder.
            </p>
          </div>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Forgot password</CardTitle>
        <CardDescription>Enter your email address and we'll send you a reset link</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
