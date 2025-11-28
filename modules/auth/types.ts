import type { UserRole } from "../common/types"

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  role: UserRole
  avatar_url?: string
  is_active: boolean
  email_verified: boolean
  created_at: string
  updated_at: string
}

export interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
  phone?: string
  company_name?: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirm {
  token: string
  password: string
}

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  actions: ("create" | "read" | "update" | "delete")[]
}

export interface RolePermissions {
  role: UserRole
  permissions: Permission[]
}
