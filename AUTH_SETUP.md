# Authentication & Authorization Setup Guide

This document explains how authentication and authorization are implemented in the TSmart Warehouse Management System.

## Overview

The application uses **Supabase Auth** for authentication with role-based access control (RBAC). The system supports three user roles:

- **Admin** - Full system access
- **Customer** - Customer dashboard access
- **Worker** - Worker dashboard access

## Features Implemented

✅ **Real authentication system** (Supabase Auth)  
✅ **Role-based access control (RBAC)**  
✅ **Session management**  
✅ **Protected route middleware**  
✅ **Password reset flow**  
✅ **Email verification**  
❌ **Two-factor authentication** (optional - not yet implemented)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up/login
2. Create a new project
3. Wait for the project to be fully provisioned

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

You can find these values in your Supabase project dashboard:
- Go to **Settings** → **API**
- Copy the **Project URL** and **anon/public** key

### 3. Configure Supabase Auth Settings

In your Supabase dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add your site URLs to **Redirect URLs**:
   - `http://localhost:3000/**` (for development)
   - `https://yourdomain.com/**` (for production)
3. Add email verification redirect URL:
   - `http://localhost:3000/verify-email`
   - `https://yourdomain.com/verify-email`
4. Add password reset redirect URL:
   - `http://localhost:3000/reset-password`
   - `https://yourdomain.com/reset-password`

### 4. Configure Email Templates (Optional)

Supabase provides default email templates, but you can customize them:

1. Go to **Authentication** → **Email Templates**
2. Customize the templates for:
   - Confirm signup
   - Reset password
   - Change email address

### 5. Set Up User Roles

User roles are stored in the `user_metadata` field of Supabase Auth users. When creating users:

- **Admin users**: Set `role: 'admin'` in user metadata
- **Worker users**: Set `role: 'worker'` in user metadata  
- **Customer users**: Default role, or set `role: 'customer'` in user metadata

You can set roles via:
- Supabase Dashboard → Authentication → Users → Edit user → User Metadata
- Or programmatically when creating users (only admins can do this)

## Architecture

### File Structure

```
├── middleware.ts                    # Route protection middleware
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Client-side Supabase client
│   │   └── server.ts               # Server-side Supabase client
│   └── auth/
│       ├── actions.ts              # Server actions (login, register, etc.)
│       ├── utils.ts                # Auth utility functions
│       └── api-middleware.ts       # API route authentication
├── components/
│   └── auth/
│       └── auth-provider.tsx       # React context for auth state
└── app/
    └── (auth)/
        ├── login/
        ├── register/
        ├── forgot-password/
        ├── reset-password/
        └── verify-email/
```

### Authentication Flow

1. **Login/Register**: User submits credentials → Supabase Auth validates → Session created → Redirect to appropriate dashboard
2. **Protected Routes**: Middleware checks session → Validates role → Allows/denies access
3. **API Routes**: Server-side auth check → Validates role → Processes request

### Session Management

- Sessions are managed by Supabase and stored in HTTP-only cookies
- The middleware automatically refreshes expired sessions
- Client-side auth state is provided via React Context (`AuthProvider`)

## Usage Examples

### Protecting a Server Component

```typescript
import { requireAuth } from '@/lib/auth/utils'

export default async function ProtectedPage() {
  const user = await requireAuth()
  // User is authenticated, use user data
  return <div>Welcome {user.name}</div>
}
```

### Requiring a Specific Role

```typescript
import { requireRole } from '@/lib/auth/utils'

export default async function AdminPage() {
  const user = await requireRole('admin')
  // User is authenticated and is an admin
  return <div>Admin Dashboard</div>
}
```

### Using Auth in Client Components

```typescript
'use client'
import { useAuth } from '@/components/auth/auth-provider'

export default function ClientComponent() {
  const { user, loading } = useAuth()
  
  if (loading) return <div>Loading...</div>
  if (!user) return <div>Not authenticated</div>
  
  return <div>Welcome {user.name}</div>
}
```

### Protecting API Routes

```typescript
import { requireAuth } from '@/lib/auth/api-middleware'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  
  if (authResult instanceof NextResponse) {
    return authResult // Error response
  }
  
  const { user } = authResult
  // Process request with authenticated user
  return NextResponse.json({ data: 'protected data' })
}
```

### Requiring Role in API Routes

```typescript
import { requireRole } from '@/lib/auth/api-middleware'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const authResult = await requireRole(request, 'admin')
  
  if (authResult instanceof NextResponse) {
    return authResult // Error response
  }
  
  const { user } = authResult
  // Process admin-only request
}
```

## Routes

### Public Routes

- `/` - Landing page
- `/login` - Login page
- `/register` - Registration page
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form
- `/verify-email` - Email verification
- `/terms` - Terms of service
- `/privacy` - Privacy policy

### Protected Routes

- `/dashboard/**` - Customer dashboard (requires customer or admin role)
- `/admin/**` - Admin dashboard (requires admin role)
- `/worker/**` - Worker dashboard (requires worker role)

## Password Requirements

- Minimum 6 characters
- Password validation happens both client-side and server-side

## Email Verification

- Users must verify their email before they can sign in
- Verification emails are sent automatically on registration
- Users can request a new verification email from the login page

## Password Reset

1. User clicks "Forgot password" on login page
2. User enters email address
3. Reset link is sent to email
4. User clicks link and is redirected to reset password page
5. User enters new password
6. Password is updated and user can sign in

## Security Features

- ✅ HTTP-only cookies for session storage
- ✅ Automatic session refresh
- ✅ Role-based access control
- ✅ Email verification
- ✅ Password reset with secure tokens
- ✅ Server-side validation
- ✅ Protected API routes

## Troubleshooting

### "Invalid login credentials" error
- Check that the user exists in Supabase
- Verify email is verified (if email verification is required)
- Check password is correct

### Redirect loop on login
- Check that redirect URLs are configured in Supabase
- Verify middleware is not blocking the route
- Check that user role is set correctly

### Email not sending
- Check Supabase email settings
- Verify SMTP configuration in Supabase (if using custom SMTP)
- Check spam folder

### Role not working
- Verify user metadata has the correct `role` field
- Check middleware role validation logic
- Ensure user metadata is set correctly

## Next Steps

- [ ] Implement two-factor authentication (optional)
- [ ] Add social authentication (Google, GitHub, etc.)
- [ ] Implement session timeout
- [ ] Add account lockout after failed attempts
- [ ] Add audit logging for authentication events

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

