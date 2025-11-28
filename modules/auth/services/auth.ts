import type { User, LoginCredentials, RegisterData, AuthSession } from "../types"

// Mock auth service - replace with actual Supabase implementation
export class AuthService {
  private static instance: AuthService
  private currentSession: AuthSession | null = null

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    // Mock implementation
    const mockUser: User = {
      id: "user-001",
      email: credentials.email,
      full_name: "Demo User",
      role: "customer",
      is_active: true,
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.currentSession = {
      user: mockUser,
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: Date.now() + 3600000,
    }

    return this.currentSession
  }

  async register(data: RegisterData): Promise<AuthSession> {
    const mockUser: User = {
      id: `user-${Date.now()}`,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: "customer",
      is_active: true,
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.currentSession = {
      user: mockUser,
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: Date.now() + 3600000,
    }

    return this.currentSession
  }

  async logout(): Promise<void> {
    this.currentSession = null
  }

  async getSession(): Promise<AuthSession | null> {
    return this.currentSession
  }

  async refreshSession(): Promise<AuthSession | null> {
    if (!this.currentSession) return null

    this.currentSession.expiresAt = Date.now() + 3600000
    return this.currentSession
  }

  async resetPassword(email: string): Promise<void> {
    // Mock implementation
    console.log(`Password reset email sent to ${email}`)
  }

  async updatePassword(token: string, newPassword: string): Promise<void> {
    // Mock implementation
    console.log(`Password updated with token ${token}`)
  }

  isAuthenticated(): boolean {
    return this.currentSession !== null && this.currentSession.expiresAt > Date.now()
  }

  getCurrentUser(): User | null {
    return this.currentSession?.user ?? null
  }

  hasRole(role: string): boolean {
    return this.currentSession?.user.role === role
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.includes(this.currentSession?.user.role ?? "")
  }
}

export const authService = AuthService.getInstance()
