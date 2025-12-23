"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "@/components/icons"
import { resetPassword } from "@/lib/auth/actions"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    // Check if we have a valid reset token in the URL
    const checkToken = async () => {
      const supabase = createClient()
      
      // Check for token in URL hash (Supabase sends it here)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')
      const refreshToken = hashParams.get('refresh_token')

      // Also check query params (some configurations use this)
      const searchParams = new URLSearchParams(window.location.search)
      const queryToken = searchParams.get('token')
      const queryType = searchParams.get('type')

      if ((accessToken && type === 'recovery') || (queryToken && queryType === 'recovery')) {
        try {
          // Set session from the recovery token
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            
            if (!sessionError) {
              setIsValidToken(true)
              return
            }
          }
        } catch (error) {
          console.error('Error setting session:', error)
        }
      }

      // Fallback: check if we already have a valid session
      const { data: { session } } = await supabase.auth.getSession()
      setIsValidToken(!!session)
    }
    checkToken()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('password', password)
    formData.append('confirmPassword', confirmPassword)

    const result = await resetPassword(formData)
    
    if (result?.error) {
      setError(result.error.message)
      setIsLoading(false)
    } else {
      // Redirect will happen in the server action
    }
  }

  if (isValidToken === false) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Invalid or expired link</CardTitle>
          <CardDescription>The password reset link is invalid or has expired</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 text-sm bg-muted rounded-md">
            <p className="mb-2">
              This password reset link is invalid or has expired. Password reset links expire after 24 hours.
            </p>
            <p>
              Please request a new password reset link to continue.
            </p>
          </div>
          <div className="flex flex-col space-y-2">
            <Link href="/forgot-password">
              <Button className="w-full">
                Request New Reset Link
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isValidToken === null) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
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
