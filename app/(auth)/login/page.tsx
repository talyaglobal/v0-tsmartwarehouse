"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Eye } from "@/components/icons"
import { EyeOff } from "lucide-react"
import { useUIStore } from "@/stores/ui.store"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const message = searchParams.get('message')
  const supabase = createClient()
  const addNotification = useUIStore((state) => state.addNotification)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    // Show success message from query param as toast
    if (message) {
      addNotification({
        type: 'success',
        message: message,
        duration: 5000,
      })
      // Clear the message from URL
      router.replace('/login', { scroll: false })
    }
    // Load saved email from localStorage if remember me was previously checked
    const savedEmail = localStorage.getItem("rememberedEmail")
    const savedRememberMe = localStorage.getItem("rememberMe") === "true"
    if (savedEmail && savedRememberMe) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [message, addNotification, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        addNotification({
          type: 'error',
          message: signInError.message === 'Invalid login credentials' 
            ? 'Invalid email or password' 
            : signInError.message,
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      if (data.user && data.session) {
        // Handle remember me functionality
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email)
          localStorage.setItem("rememberMe", "true")
        } else {
          localStorage.removeItem("rememberedEmail")
          localStorage.removeItem("rememberMe")
        }

        // Check if profile exists, if not create it from auth data
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, name, email, invitation_token, company_id')
          .eq('id', data.user.id)
          .maybeSingle()

        // If profile has a pending invitation (invitation_token exists and company_id is NULL),
        // automatically accept it since user has logged in with the correct credentials
        if (profile && profile.invitation_token && !profile.company_id) {
          console.log('📧 User has pending invitation, accepting automatically...')
          try {
            const acceptResponse = await fetch(`/api/v1/invitations/${profile.invitation_token}/accept`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            })
            
            if (acceptResponse.ok) {
              console.log('✅ Invitation accepted automatically')
              addNotification({
                type: 'success',
                message: 'Your invitation has been accepted automatically',
                duration: 5000,
              })
            } else {
              console.error('Failed to accept invitation:', await acceptResponse.text())
            }
          } catch (acceptError) {
            console.error('Error accepting invitation:', acceptError)
            // Continue with login even if invitation acceptance fails
          }
        }

        // If profile doesn't exist, create it from auth data
        if (!profile) {
          console.log('📝 Profile not found, creating profile from auth data...')
          
          const userMetadata = data.user.user_metadata || {}
          const userEmail = data.user.email || email
          const userName = userMetadata.name || userEmail.split('@')[0]
          const userRole = userMetadata.role || 'customer'

          // Call API to create profile (server-side to use admin client)
          const createProfileResponse = await fetch('/api/v1/profile/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: data.user.id,
              email: userEmail,
              name: userName,
              role: userRole,
              phone: userMetadata.phone || null,
              company: userMetadata.company || null,
            }),
          })

          if (!createProfileResponse.ok) {
            console.error('Failed to create profile, but continuing with login...')
            // Don't fail login, continue
          } else {
            console.log('✅ Profile created successfully from auth data')
          }
        }

        const role = profile?.role || data.user.user_metadata?.role || 'customer'

        // Determine redirect path
        let redirectPath = '/dashboard'
        if (redirect) {
          redirectPath = redirect
        } else if (role === 'admin') {
          redirectPath = '/admin'
        } else if (role === 'worker') {
          redirectPath = '/worker'
        }

        // Show success message
        addNotification({
          type: 'success',
          message: 'Login successful! Redirecting...',
          duration: 2000,
        })

        // Wait for auth state to be fully synchronized before redirecting
        // This ensures cookies are set and middleware can see the session
        const authStatePromise = new Promise<void>((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            if (event === 'SIGNED_IN' && session) {
              subscription.unsubscribe()
              resolve()
            }
          })
          
          // Fallback timeout in case auth state change doesn't fire
          setTimeout(() => {
            subscription.unsubscribe()
            resolve()
          }, 1000)
        })

        await authStatePromise

        // Small additional delay to ensure cookies are fully set
        await new Promise(resolve => setTimeout(resolve, 300))

        // Use window.location for hard redirect to ensure cookies are sent to server
        window.location.href = redirectPath
      } else if (data.user && !data.session) {
        // User exists but no session - this shouldn't happen but handle it
        setError('Session could not be established. Please try again.')
        addNotification({
          type: 'error',
          message: 'Session could not be established. Please try again.',
          duration: 5000,
        })
        setIsLoading(false)
      } else {
        setError('Login failed. Please try again.')
        addNotification({
          type: 'error',
          message: 'Login failed. Please try again.',
          duration: 5000,
        })
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login')
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              disabled={isLoading}
            />
            <Label
              htmlFor="remember-me"
              className="text-sm font-normal cursor-pointer"
            >
              Remember me
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
