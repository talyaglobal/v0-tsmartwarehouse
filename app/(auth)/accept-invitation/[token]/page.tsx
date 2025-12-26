"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, XCircle, AlertCircle, Eye } from "@/components/icons"
import { EyeOff } from "lucide-react"
import { api } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export default function AcceptInvitationPage() {
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'form'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<any>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Invalid invitation link')
      return
    }

    // Fetch invitation details
    fetchInvitation()
  }, [token])

  const fetchInvitation = async () => {
    try {
      // We need to find the invitation by token
      // Since we don't have a direct API endpoint, we'll use a workaround
      // First, try to get invitation info from a new API endpoint
      const result = await api.get(`/api/v1/invitations/${token}`, { showToast: false })
      
      if (result.success && result.data) {
        setInvitation(result.data)
        setStatus('form')
      } else {
        setStatus('error')
        setError(result.error || 'Invitation not found or has expired')
      }
    } catch (err: any) {
      console.error('Error fetching invitation:', err)
      setStatus('error')
      setError(err.message || 'Failed to load invitation')
    }
  }

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await api.post(`/api/v1/invitations/${token}/accept`, {
        password,
      }, { showToast: false })

      if (result.success) {
        setStatus('success')
        setRedirecting(true)
        
        // Get email from result or invitation
        const userEmail = result.data?.email || invitation?.email
        
        // Auto-login with the new password that user just set
        if (userEmail && password) {
          const supabase = createClient()
          
          // Wait a moment for password to be updated in Auth system
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
              email: userEmail,
              password: password, // Use the new password that user just set
            })

            if (!signInError && data.user) {
              // Redirect to dashboard immediately after successful login
              router.push('/dashboard')
              return // Exit early to prevent double redirect
            } else {
              console.error('Auto-login failed:', signInError?.message)
              // If auto-login fails, redirect to login page
              router.push('/login?message=Invitation accepted. Please log in with your new password.')
            }
          } catch (loginError) {
            console.error('Login error:', loginError)
            // If login throws an error, redirect to login page
            router.push('/login?message=Invitation accepted. Please log in with your new password.')
          }
        } else {
          // If no email, redirect to login
          router.push('/login?message=Invitation accepted. Please log in with your new password.')
        }
      } else {
        setError(result.error || 'Failed to accept invitation')
        setStatus('form')
      }
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      setError(err.message || 'Failed to accept invitation')
      setStatus('form')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Invitation Error
            </CardTitle>
            <CardDescription>
              {error || 'An error occurred while processing your invitation'}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Invitation Accepted!
            </CardTitle>
            <CardDescription>
              {redirecting 
                ? 'Logging you in and redirecting to dashboard...'
                : 'You have successfully accepted the invitation. Redirecting...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            {invitation?.companyName 
              ? `You've been invited to join ${invitation.companyName} as ${invitation.role}`
              : 'Set your password to accept the invitation'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAccept}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
            <Button type="button" variant="ghost" asChild className="w-full">
              <Link href="/login">Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
