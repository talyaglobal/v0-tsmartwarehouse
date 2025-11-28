import { createClient } from "./client"
import type { UserRole } from "@/types/database"

export async function signUp(email: string, password: string, fullName: string, companyName?: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
      data: {
        full_name: fullName,
        company_name: companyName,
      },
    },
  })

  return { data, error }
}

export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getUser() {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { user, error }
}

export async function getProfile() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { profile: null, error: new Error("Not authenticated") }

  const { data: profile, error } = await supabase.from("profiles").select("*, companies(*)").eq("id", user.id).single()

  return { profile, error }
}

export async function updateProfile(updates: {
  full_name?: string
  phone?: string
  notify_via_email?: boolean
  notify_via_whatsapp?: boolean
  whatsapp_number?: string
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: new Error("Not authenticated") }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id)

  return { error }
}

export function getRoleRedirect(role: UserRole): string {
  switch (role) {
    case "ADMIN":
    case "OP_MANAGER":
    case "FINANCE":
      return "/admin/dashboard"
    case "WORKER":
      return "/worker/tasks"
    case "CUSTOMER":
    default:
      return "/dashboard"
  }
}
