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
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().optional(),
  companyName: z.string().min(2, 'Company name must be at least 2 characters').optional(),
  role: z.enum(['warehouse_client', 'root', 'warehouse_staff', 'warehouse_supervisor', 'warehouse_admin']).optional(),
  storageType: z.string().optional(),
  userType: z.enum(['owner', 'warehouse_client', 'warehouse_broker', 'warehouse_finder']).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine((data) => {
  // For owners, name and companyName are required
  if (data.userType === 'owner') {
    return data.name && data.name.length >= 2 && data.companyName && data.companyName.length >= 2
  }
  // For brokers and finders, name is required
  if (data.userType === 'warehouse_broker' || data.userType === 'warehouse_finder') {
    return data.name && data.name.length >= 2
  }
  // For customers, name and companyName are not required
  return true
}, {
  message: "Name is required for warehouse owners, brokers, and finders",
  path: ['name'],
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
    const userRole = data.user.user_metadata?.role || 'warehouse_client'
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
    const name = formData.get('name') as string | null
    const phone = formData.get('phone') as string | null
    const companyName = formData.get('companyName') as string | null
    const storageType = formData.get('storageType') as string | null
    const userType = formData.get('userType') as 'owner' | 'warehouse_client' | 'warehouse_broker' | 'warehouse_finder' | null

    // Validate input
    const validation = registerSchema.safeParse({
      email,
      password,
      confirmPassword,
      name: name || undefined,
      phone: phone || undefined,
      companyName: companyName || undefined,
      storageType: storageType || undefined,
      userType: userType || 'owner', // Default to owner for backward compatibility
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

    // Determine user role based on userType
    const isCustomer = validation.data.userType === 'warehouse_client'
    const isReseller = validation.data.userType === 'warehouse_broker'
    const isFinder = validation.data.userType === 'warehouse_finder'
    
    // Map userType to role
    let defaultRole = 'warehouse_admin' // Default
    if (isCustomer) {
      defaultRole = 'warehouse_client'
    } else if (isReseller) {
      defaultRole = 'warehouse_broker'
    } else if (isFinder) {
      defaultRole = 'warehouse_finder'
    }

    // Create user directly with admin API (no email sent)
    console.log('Creating user with email:', validation.data.email, 'User type:', validation.data.userType || 'owner')
    console.log('User metadata:', {
      name: isCustomer ? null : (validation.data.name || null),
      phone: validation.data.phone || null,
      role: defaultRole,
      storage_interest: validation.data.storageType || null,
    })
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.password,
      email_confirm: true, // Auto-confirm email (no verification needed)
      user_metadata: {
        name: isCustomer ? null : (validation.data.name || null),
        phone: validation.data.phone || null,
        role: defaultRole,
        storage_interest: validation.data.storageType || null,
      },
    })

    if (error) {
      console.error('User creation error:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      })
      // Return more detailed error message for debugging
      const errorMessage = error.message || 'Database error creating new user'
      const errorDetails = (error as any).details ? ` Details: ${(error as any).details}` : ''
      const errorHint = (error as any).hint ? ` Hint: ${(error as any).hint}` : ''
      return {
        error: {
          message: `${errorMessage}${errorDetails}${errorHint}`,
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
      
      // For warehouse clients, brokers, and finders, skip company creation
      if (isCustomer || isReseller || isFinder) {
        // Create profile for warehouse client/broker/finder (no company)
        const { data: insertedProfile, error: profileCreateError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: validation.data.email,
            name: (isReseller || isFinder) ? validation.data.name : null, // Brokers and finders have name
            role: defaultRole,
            phone: validation.data.phone || null,
            company_id: null, // No company for these roles
          }, {
            onConflict: 'id'
          })
          .select()
          .single()

        if (profileCreateError) {
          console.error('Profile creation error:', profileCreateError)
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
        console.log(`${defaultRole} profile created:`, insertedProfile?.id)
        return { error: undefined }
      }

      // For warehouse owners, continue with company creation logic
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
      
      let companyId: string
      let finalRole: 'warehouse_admin' | 'warehouse_supervisor' = 'warehouse_admin'

      if (existingCompany) {
        // Exact match found - but this should not happen in normal flow
        // User should have selected from suggestions, but handle it anyway
        companyId = existingCompany.id
        console.log('Using existing company:', existingCompany.name)
        finalRole = 'warehouse_admin' // Use warehouse_admin for existing company
        
        // Update profile with company_id and role
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            role: finalRole,
          })
          .eq('id', data.user.id)
        
        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError)
        } else {
          console.log('User profile updated with company_id and warehouse_admin role')
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
        finalRole = 'warehouse_admin' // New warehouse owner gets warehouse_admin role
        
        // Update profile with company_id and warehouse_owner role
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            role: finalRole,
          })
          .eq('id', data.user.id)
        
        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError)
        } else {
          console.log('User profile updated with company_id and warehouse_owner role')
        }
      }

      // Now create/update profile with company_id and correct role
      const { data: insertedProfile, error: profileCreateError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: validation.data.email,
          name: validation.data.name,
          role: finalRole,
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
    // Server actions run on server, need absolute URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const apiUrl = `${siteUrl}/api/v1/auth/request-password-reset`

    console.log('Requesting password reset via API:', email)

    // Add timeout to fetch request (30 seconds)
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout | null = null

    try {
      timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      })

      if (timeoutId) clearTimeout(timeoutId)

      if (!response.ok) {
        console.error('Password reset API error:', response.status, response.statusText)
        // Return success anyway to prevent email enumeration
        return {}
      }

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
      if (timeoutId) clearTimeout(timeoutId)
      console.error('Password reset API error:', error)
      
      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          error: {
            message: 'Request timed out. Please check your connection and try again.',
          },
        }
      }
      
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

    const supabase = await createClient()
    
    // Get current user to check role for redirect
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return {
        error: {
          message: 'User session not found. Please use the reset link from your email.',
        },
      }
    }

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

    // Get user profile to determine role and redirect path
    const supabaseAdmin = await createServerSupabaseClient()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Map legacy roles to new roles
    let role = profile?.role || user.user_metadata?.role || 'warehouse_client'
    if (role === 'super_admin') role = 'root'
    else if (role === 'customer') role = 'warehouse_client'
    else if (role === 'worker') role = 'warehouse_staff'
    else if (role === 'member') role = 'warehouse_client'

    // Determine redirect path based on role
    let redirectPath = '/dashboard'
    if (role === 'root') {
      redirectPath = '/admin'
    } else if (role === 'warehouse_staff') {
      redirectPath = '/warehouse'
    } else if (['warehouse_supervisor', 'warehouse_client', 'warehouse_admin'].includes(role)) {
      redirectPath = '/dashboard'
    }

    revalidatePath('/')
    redirect(redirectPath)
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

