'use server'

import { createAuthenticatedSupabaseClient, createClient, createServerSupabaseClient } from '@/lib/supabase/server'
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
  phone: z.string().optional(),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  role: z.enum(['member', 'root', 'warehouse_staff', 'company_admin', 'owner']).optional(),
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

    // Email verification check removed - users can login immediately

    // Determine redirect based on user role
    const userRole = data.user.user_metadata?.role || 'member'
    let redirectPath = '/dashboard'

    if (redirectTo && !redirectTo.startsWith('/login') && !redirectTo.startsWith('/register')) {
      redirectPath = redirectTo
    } else if (userRole === 'super_admin') {
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
    const phone = formData.get('phone') as string | null
    const companyName = formData.get('companyName') as string | null
    const storageType = formData.get('storageType') as string | null

    // Validate input
    const validation = registerSchema.safeParse({
      email,
      password,
      confirmPassword,
      name,
      phone: phone || undefined,
      companyName: companyName || undefined,
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

    // Use admin API to create user directly (no email sent)
    const supabaseAdmin = createServerSupabaseClient()
    
    // Check if service role key is configured
    const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!hasServiceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured!')
      return {
        error: {
          message: 'Server configuration error. Please contact support.',
        },
      }
    }
    
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error checking existing users:', listError)
      return {
        error: {
          message: 'Database error. Please try again.',
        },
      }
    }
    
    const userExists = existingUsers?.users?.find(u => u.email === validation.data.email)
    
    if (userExists) {
      return {
        error: {
          message: 'An account with this email already exists.',
        },
      }
    }

    // Create user directly with admin API (no email sent)
    console.log('Creating user with email:', validation.data.email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.password,
      email_confirm: true, // Auto-confirm email (no verification needed)
      user_metadata: {
        name: validation.data.name,
        phone: validation.data.phone || null,
        role: 'member', // Default role for new users
        storage_interest: validation.data.storageType || null,
      },
    })

    if (error) {
      console.error('User creation error:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
      })
      return {
        error: {
          message: error.message || 'Database error creating new user',
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

    console.log('User created successfully, ID:', data.user.id)
    
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify profile was created by trigger, if not create it manually
    console.log('Checking if profile exists...')
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .single()

    if (profileCheckError) {
      console.log('Profile check error (might be normal if profile does not exist yet):', profileCheckError.message)
    }

    if (profileCheckError || !existingProfile) {
      // Profile doesn't exist, create it manually
      console.log('Profile not found, creating manually...')
      
      // Get company name from form data
      const companyName = formData.get('companyName') as string | null
      
      if (!companyName || !companyName.trim()) {
        // Try to delete the user if company name is missing
        try {
          await supabaseAdmin.auth.admin.deleteUser(data.user.id)
          console.log('User deleted after missing company name')
        } catch (deleteError) {
          console.error('Failed to delete user:', deleteError)
        }
        return {
          error: {
            message: 'Company name is required.',
          },
        }
      }

      // Check if company exists (exact match, case-insensitive)
      const trimmedCompanyName = companyName.trim()
      
      // Search for companies with similar names
      const { data: similarCompanies } = await supabaseAdmin
        .from('companies')
        .select('id, name')
        .ilike('name', `%${trimmedCompanyName}%`)
        .eq('type', 'customer_company')
      
      // Find exact match (case-insensitive)
      const existingCompany = similarCompanies?.find(
        (c) => c.name.toLowerCase() === trimmedCompanyName.toLowerCase()
      ) || null
      
      const isExactMatch = !!existingCompany

      let companyId: string

      if (isExactMatch && existingCompany) {
        // Exact match found - use existing company
        companyId = existingCompany.id
        console.log('Using existing company:', existingCompany.name)
        
        // Update profile with company_id and role
        // company_members table no longer exists, company_id and role are in profiles table
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            role: 'member', // Default role for new members
          })
          .eq('id', data.user.id)
        
        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError)
          // Don't fail registration if profile update fails, but log it
        } else {
          console.log('User profile updated with company_id')
        }
      } else {
        // No exact match - create new company
        // But first check if company name already exists (prevent duplicates)
        const { data: duplicateCheck } = await supabaseAdmin
          .from('companies')
          .select('id, name')
          .eq('type', 'customer_company')
          .limit(100) // Get all to check exact match
        
        const duplicate = duplicateCheck?.find(
          (c) => c.name.toLowerCase() === trimmedCompanyName.toLowerCase()
        )
        
        if (duplicate) {
          // Company already exists - user should select it
          try {
            await supabaseAdmin.auth.admin.deleteUser(data.user.id)
            console.log('User deleted - company already exists')
          } catch (deleteError) {
            console.error('Failed to delete user:', deleteError)
          }
          return {
            error: {
              message: `Company "${duplicate.name}" already exists. Please select it from the suggestions.`,
            },
          }
        }
        
        // Create new company
        const { data: newCompany, error: companyCreateError } = await supabaseAdmin
          .from('companies')
          .insert({
            name: trimmedCompanyName,
            type: 'customer_company',
          })
          .select()
          .single()

        if (companyCreateError) {
          console.error('Company creation error:', companyCreateError)
          try {
            await supabaseAdmin.auth.admin.deleteUser(data.user.id)
            console.log('User deleted after company creation failure')
          } catch (deleteError) {
            console.error('Failed to delete user after company creation error:', deleteError)
          }
          return {
            error: {
              message: `Failed to create company: ${companyCreateError.message}. Please try again.`,
            },
          }
        }
        companyId = newCompany.id
        console.log('Created new company:', newCompany.name)
        
        // Update profile with company_id and owner role
        // company_members table no longer exists, company_id and role are in profiles table
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            role: 'owner', // Company creator is owner
          })
          .eq('id', data.user.id)
        
        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError)
          // Don't fail registration if profile update fails, but log it
        } else {
          console.log('User profile updated with company_id and owner role')
        }
      }

      // Now create profile with company_id
      const { data: insertedProfile, error: profileCreateError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: validation.data.email,
          name: validation.data.name,
          role: 'member',
          phone: validation.data.phone || null,
          storage_interest: validation.data.storageType || null,
          company_id: companyId,
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (profileCreateError) {
        console.error('Profile creation error:', profileCreateError)
        console.error('Profile creation error details:', {
          code: profileCreateError.code,
          message: profileCreateError.message,
          details: profileCreateError.details,
          hint: profileCreateError.hint,
        })
        
        // Try to delete the user if profile creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(data.user.id)
          console.log('User deleted after profile creation failure')
        } catch (deleteError) {
          console.error('Failed to cleanup after profile creation error:', deleteError)
        }
        return {
          error: {
            message: `Account creation failed: ${profileCreateError.message}. Please try again.`,
          },
        }
      }
      console.log('Profile created manually:', insertedProfile?.id)
    } else {
      console.log('Profile already exists (created by trigger)')
    }

    // Registration successful - user can login immediately (no email sent)
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
 * Request password reset via email
 */
export async function requestPasswordReset(formData: FormData): Promise<{ error?: AuthError }> {
  try {
    const email = formData.get('email') as string

    if (!email) {
      return {
        error: {
          message: 'Email is required',
          field: 'email',
        },
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        error: {
          message: 'Invalid email address',
          field: 'email',
        },
      }
    }

    // Use API endpoint that uses nodemailer
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'
    const apiUrl = `${siteUrl}/api/v1/auth/request-password-reset`

    console.log('Requesting password reset via API:', email)

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!result.success) {
        // Check for specific errors that we should show
        if (result.error?.includes('rate limit') || result.error?.includes('too many requests')) {
          return {
            error: {
              message: 'Too many requests. Please try again later.',
            },
          }
        }
      }

      // Always return success (don't reveal if email exists)
      return {}
    } catch (error) {
      console.error('Password reset API error:', error)
      // Return success anyway to prevent email enumeration
      return {}
    }
  } catch (error) {
    console.error('Password reset request error:', error)
    // Return success anyway to prevent email enumeration
    return {}
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
 * Resend email verification (DISABLED - Email sending disabled)
 */
export async function resendVerificationEmail(_email: string): Promise<{ error?: AuthError }> {
  return {
    error: {
      message: 'Email verification is currently disabled. Your account is automatically verified.',
    },
  }
}

