'use server'

import { createAuthenticatedSupabaseClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['customer', 'admin', 'worker']).optional(),
  storageType: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export interface AuthError {
  message: string
  field?: string
}

/**
 * Sign in with email and password
 */
export async function signIn(formData: FormData): Promise<{ error?: AuthError }> {
  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const redirectTo = formData.get('redirect') as string | null

    // Validate input
    const validation = loginSchema.safeParse({ email, password })
    if (!validation.success) {
      return {
        error: {
          message: validation.error.errors[0].message,
          field: validation.error.errors[0].path[0] as string,
        },
      }
    }

    const supabase = await createAuthenticatedSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    })

    if (error) {
      return {
        error: {
          message: error.message === 'Invalid login credentials' 
            ? 'Invalid email or password' 
            : error.message,
        },
      }
    }

    if (!data.user) {
      return {
        error: {
          message: 'Login failed. Please try again.',
        },
      }
    }

    // Check if email is verified
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()
      return {
        error: {
          message: 'Please verify your email before signing in. Check your inbox for a verification link.',
        },
      }
    }

    // Determine redirect based on user role
    const userRole = data.user.user_metadata?.role || 'customer'
    let redirectPath = '/dashboard'

    if (redirectTo && !redirectTo.startsWith('/login') && !redirectTo.startsWith('/register')) {
      redirectPath = redirectTo
    } else if (userRole === 'admin') {
      redirectPath = '/admin'
    } else if (userRole === 'worker') {
      redirectPath = '/worker'
    }

    revalidatePath('/')
    redirect(redirectPath)
  } catch (error) {
    console.error('Sign in error:', error)
    return {
      error: {
        message: 'An unexpected error occurred. Please try again.',
      },
    }
  }
}

/**
 * Sign up with email and password
 */
export async function signUp(formData: FormData): Promise<{ error?: AuthError }> {
  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const name = formData.get('name') as string
    const company = formData.get('company') as string | null
    const phone = formData.get('phone') as string | null
    const storageType = formData.get('storageType') as string | null

    // Validate input
    const validation = registerSchema.safeParse({
      email,
      password,
      confirmPassword,
      name,
      company: company || undefined,
      phone: phone || undefined,
      storageType: storageType || undefined,
    })

    if (!validation.success) {
      return {
        error: {
          message: validation.error.errors[0].message,
          field: validation.error.errors[0].path[0] as string,
        },
      }
    }

    const supabase = await createAuthenticatedSupabaseClient()
    
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        data: {
          name: validation.data.name,
          company: validation.data.company || null,
          phone: validation.data.phone || null,
          role: 'customer', // Default role for new users
          storage_interest: validation.data.storageType || null,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email`,
      },
    })

    if (error) {
      return {
        error: {
          message: error.message,
        },
      }
    }

    if (!data.user) {
      return {
        error: {
          message: 'Registration failed. Please try again.',
        },
      }
    }

    // Registration successful - user will need to verify email
    return { error: undefined }
  } catch (error) {
    console.error('Sign up error:', error)
    return {
      error: {
        message: 'An unexpected error occurred. Please try again.',
      },
    }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/')
  redirect('/login')
}

/**
 * Request password reset
 */
export async function requestPasswordReset(formData: FormData): Promise<{ error?: AuthError }> {
  try {
    const email = formData.get('email') as string

    if (!email || !z.string().email().safeParse(email).success) {
      return {
        error: {
          message: 'Invalid email address',
          field: 'email',
        },
      }
    }

    const supabase = await createAuthenticatedSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    })

    if (error) {
      return {
        error: {
          message: error.message,
        },
      }
    }

    return { error: undefined }
  } catch (error) {
    console.error('Password reset request error:', error)
    return {
      error: {
        message: 'An unexpected error occurred. Please try again.',
      },
    }
  }
}

/**
 * Reset password with new password
 */
export async function resetPassword(formData: FormData): Promise<{ error?: AuthError }> {
  try {
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!password || password.length < 6) {
      return {
        error: {
          message: 'Password must be at least 6 characters',
          field: 'password',
        },
      }
    }

    if (password !== confirmPassword) {
      return {
        error: {
          message: "Passwords don't match",
          field: 'confirmPassword',
        },
      }
    }

    const supabase = await createAuthenticatedSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      return {
        error: {
          message: error.message,
        },
      }
    }

    revalidatePath('/')
    redirect('/login?message=Password reset successful. Please sign in with your new password.')
  } catch (error) {
    console.error('Password reset error:', error)
    return {
      error: {
        message: 'An unexpected error occurred. Please try again.',
      },
    }
  }
}

/**
 * Resend email verification
 */
export async function resendVerificationEmail(email: string): Promise<{ error?: AuthError }> {
  try {
    if (!email || !z.string().email().safeParse(email).success) {
      return {
        error: {
          message: 'Invalid email address',
          field: 'email',
        },
      }
    }

    const supabase = await createAuthenticatedSupabaseClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email`,
      },
    })

    if (error) {
      return {
        error: {
          message: error.message,
        },
      }
    }

    return { error: undefined }
  } catch (error) {
    console.error('Resend verification error:', error)
    return {
      error: {
        message: 'An unexpected error occurred. Please try again.',
      },
    }
  }
}

