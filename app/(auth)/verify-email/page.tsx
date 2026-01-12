"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle } from "@/components/icons"
import { resendVerificationEmail } from "@/lib/auth/actions"
import { createClient } from "@/lib/supabase/client"

export default function VerifyEmailPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    const handleVerification = async () => {
      const supabase = createClient()
      
      // Check if we have a token in the URL hash (Supabase sends it here)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')

      if (accessToken && type === 'email') {
        try {
          // Set the session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          })

          if (error) {
            setStatus('error')
            return
          }

          if (data.user) {
            setStatus('success')
            setEmail(data.user.email || null)
            
            // Redirect after a short delay
            setTimeout(() => {
              const userRole = data.user?.user_metadata?.role || 'warehouse_client'
              if (userRole === 'super_admin') {
                router.push('/admin')
              } else if (userRole === 'worker') {
                router.push('/worker')
              } else {
                router.push('/dashboard')
              }
            }, 2000)
          }
        } catch (error) {
          console.error('Verification error:', error)
          setStatus('error')
        }
      } else {
        // No token in URL - check if user is already verified
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email_confirmed_at) {
          setStatus('success')
          setEmail(user.email || null)
        } else {
          setStatus('pending')
          setEmail(user?.email || null)
        }
      }
    }

    handleVerification()
  }, [router])

  const handleResend = async () => {
    if (!email) return
    
    setIsResending(true)
    setResendMessage(null)

    const result = await resendVerificationEmail(email)
    
    if (result?.error) {
      setResendMessage(result.error.message)
    } else {
      setResendMessage('Verification email sent! Please check your inbox.')
    }
    
    setIsResending(false)
  }

  if (status === 'loading') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your email...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'success') {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Email verified!
          </CardTitle>
          <CardDescription>Your email has been successfully verified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 text-sm bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
            <p>
              Your email address <strong>{email}</strong> has been verified successfully. 
              Redirecting you to your dashboard...
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/dashboard" className="w-full">
            <Button className="w-full">Go to Dashboard</Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl flex items-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            Verification failed
          </CardTitle>
          <CardDescription>The verification link is invalid or has expired</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 text-sm bg-destructive/10 rounded-md border border-destructive/20">
            <p>
              The email verification link is invalid or has expired. Please request a new verification email.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {email && (
            <Button
              onClick={handleResend}
              disabled={isResending}
              className="w-full"
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend Verification Email
            </Button>
          )}
          {resendMessage && (
            <p className={`text-sm text-center ${resendMessage.includes('sent') ? 'text-green-600' : 'text-destructive'}`}>
              {resendMessage}
            </p>
          )}
          <Link href="/login" className="w-full">
            <Button variant="ghost" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // Pending verification
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Verify your email</CardTitle>
        <CardDescription>Please check your email to verify your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 text-sm bg-muted rounded-md">
          <p className="mb-2">
            We've sent a verification email to <strong>{email}</strong>
          </p>
          <p>
            Please check your inbox and click the verification link to activate your account. 
            If you don't see the email, check your spam folder.
          </p>
        </div>
        {resendMessage && (
          <p className={`text-sm text-center ${resendMessage.includes('sent') ? 'text-green-600' : 'text-destructive'}`}>
            {resendMessage}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        {email && (
          <Button
            onClick={handleResend}
            disabled={isResending}
            variant="outline"
            className="w-full"
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resend Verification Email
          </Button>
        )}
        <Link href="/login" className="w-full">
          <Button variant="ghost" className="w-full">
            Back to Sign In
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

