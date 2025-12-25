'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { acceptInvitation } from '@/features/companies/actions'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AcceptInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
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
      const supabase = createClient()
      
      // Get invitation details
      const invitationResponse = await fetch(`/api/v1/invitations/${token}`)
      const invitationData = await invitationResponse.json()

      if (!invitationData.success) {
        setStatus('error')
        setError(invitationData.error || 'Invitation not found')
        return
      }

      // Get company_id from invitation for cache invalidation
      const companyId = invitationData.data?.companyId
      const invitationEmail = invitationData.data?.email
      const invitationPassword = invitationData.data?.password

      // Check if user is already logged in
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        // User is not logged in - try auto-login with password from invitation
        if (invitationPassword && invitationEmail) {
          console.log('🔐 Attempting auto-login with invitation password...')
          try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: invitationEmail,
              password: invitationPassword,
            })

            if (signInError) {
              console.error('Auto-login error:', signInError)
              // If auto-login fails, redirect to login page
              window.location.href = `/login?invitation=${token}`
              return
            }

            if (signInData.user && signInData.session) {
              console.log('✅ Auto-login successful')
              // Wait a moment for session to be established
              await new Promise(resolve => setTimeout(resolve, 500))
              // Continue with invitation acceptance below
            } else {
              // Auto-login didn't create session, redirect to login
              window.location.href = `/login?invitation=${token}`
              return
            }
          } catch (loginError) {
            console.error('Error during auto-login:', loginError)
            // If auto-login fails, redirect to login page
            window.location.href = `/login?invitation=${token}`
            return
          }
        } else {
          // No password available, redirect to login/register
          window.location.href = `/login?invitation=${token}`
          return
        }
      }

      // User is now logged in (either was already logged in or just auto-logged in)
      // Verify the logged-in user's email matches the invitation email
      const { data: { user: loggedInUser } } = await supabase.auth.getUser()
      if (loggedInUser && invitationEmail && loggedInUser.email?.toLowerCase() !== invitationEmail.toLowerCase()) {
        setStatus('error')
        setError('Invitation email does not match your account. Please log in with the email address that received the invitation.')
        return
      }

      // User is logged in, proceed with accepting invitation
      const result = await acceptInvitation(token)

      if (result.success) {
        setStatus('success')
        
        // Invalidate queries to refresh team members and invitations lists
        if (companyId) {
          queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
          queryClient.invalidateQueries({ queryKey: ['company-invitations', companyId] })
        }
        
        // Wait a moment for profile to be created/updated
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Check if user has a name, if not redirect to settings/profile
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle()
          
          if (!profile?.name || profile.name.trim() === '') {
            // Redirect to settings/profile to complete profile
            setTimeout(() => {
              window.location.href = '/dashboard/settings?tab=profile'
            }, 1500)
            return
          }
        }
        
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
      } else if (result.requiresRegistration) {
        // Redirect to register page with invitation token
        router.push(`/register?invitation=${token}`)
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

