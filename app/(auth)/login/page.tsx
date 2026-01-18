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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setError(null)

    try {
      // Determine redirect path based on user role (will be handled after OAuth callback)
      const redirectPath = redirect || '/dashboard'
      
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        addNotification({
          type: 'error',
          message: oauthError.message || 'Google ile giriş yapılırken bir hata oluştu',
          duration: 5000,
        })
        setIsGoogleLoading(false)
        return
      }

      // OAuth redirect will happen automatically
      // Supabase will handle the OAuth flow and redirect back to redirectTo URL
      // The middleware and auth state will handle session management
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google ile giriş yapılırken bir hata oluştu')
      addNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Google ile giriş yapılırken bir hata oluştu',
        duration: 5000,
      })
      setIsGoogleLoading(false)
    }
  }

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
          try {
            const acceptResponse = await fetch(`/api/v1/invitations/${profile.invitation_token}/accept`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            })
            
            if (acceptResponse.ok) {
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
          
          const userMetadata = data.user.user_metadata || {}
          const userEmail = data.user.email || email
          const userName = userMetadata.name || userEmail.split('@')[0]
          const userRole = userMetadata.role || 'warehouse_client'

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
          }
        }

        // Get role from profile and map legacy roles to new roles
        let role = profile?.role || data.user.user_metadata?.role || 'warehouse_client'
        
        // Map legacy roles to new roles
        if (role === 'super_admin') role = 'root'
        else if (role === 'customer') role = 'warehouse_client'
        else if (role === 'member') role = 'warehouse_client'
        else if (role === 'worker') role = 'warehouse_staff'

        // Determine redirect path based on new role system
        let redirectPath = '/dashboard'
        if (redirect) {
          // If redirect is a full URL (starts with http:// or https:// or /), use it directly
          if (redirect.startsWith('http://') || redirect.startsWith('https://') || redirect.startsWith('/')) {
            redirectPath = redirect
          } else {
            redirectPath = redirect
          }
        } else if (role === 'root') {
          redirectPath = '/admin'
        } else if (role === 'warehouse_staff') {
          redirectPath = '/warehouse'
        } else if (['warehouse_supervisor', 'warehouse_client', 'warehouse_admin'].includes(role)) {
          redirectPath = '/dashboard'
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

        // Use router.push for relative paths, window.location for full URLs
        // This ensures proper session handling
        if (redirectPath.startsWith('http://') || redirectPath.startsWith('https://')) {
          window.location.href = redirectPath
        } else {
          router.push(redirectPath)
          router.refresh()
        }
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
          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>

          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
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
