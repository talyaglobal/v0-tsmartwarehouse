# Supabase Authentication Integration

This project now includes full Supabase authentication integration with session management, protected routes, and role-based access control.

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully provisioned

### 2. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your Supabase credentials to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 4. Run Database Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Copy the contents of `supabase/migrations/001_create_profiles_table.sql`
3. Paste and run the SQL in the SQL Editor
4. This will create:
   - `profiles` table for user metadata
   - Row Level Security (RLS) policies
   - Automatic profile creation trigger
   - Indexes for performance

### 5. Configure Supabase Auth Settings

1. Go to **Authentication** → **URL Configuration**
2. Add your site URL (e.g., `http://localhost:3000` for development)
3. Add redirect URLs:
   - `http://localhost:3000/reset-password` (for development)
   - `https://yourdomain.com/reset-password` (for production)

### 6. (Optional) Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize the email templates for:
   - Confirm signup
   - Reset password
   - Magic link

## Features Implemented

### ✅ Authentication
- User registration with email/password
- User login with email/password
- Password reset flow (forgot password → email link → reset password)
- Session management with automatic token refresh
- Secure cookie-based session storage

### ✅ Protected Routes
- Middleware automatically protects all routes except public ones
- Unauthenticated users are redirected to `/login`
- Authenticated users are redirected away from auth pages

### ✅ Role-Based Access Control (RBAC)
- Three user roles: `admin`, `customer`, `worker`
- Role-based route protection:
  - `/admin/*` - Only accessible by admin users
  - `/worker/*` - Only accessible by worker users
  - `/dashboard/*` - Accessible by customer and admin users
- Automatic role-based redirects after login

### ✅ Session Management
- Client-side auth context (`AuthProvider`)
- Server-side auth utilities (`lib/auth.ts`)
- Automatic session refresh
- Sign out functionality

### ✅ User Profiles
- Extended user metadata in `profiles` table
- Automatic profile creation on user signup
- Profile fields: name, company, phone, role, membership_tier, etc.

## Usage

### Client-Side Authentication

```tsx
import { useAuth } from '@/components/auth/auth-provider'

function MyComponent() {
  const { user, userRole, loading, signOut } = useAuth()
  
  if (loading) return <div>Loading...</div>
  if (!user) return <div>Not authenticated</div>
  
  return (
    <div>
      <p>Welcome, {user.email}</p>
      <p>Role: {userRole}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

### Server-Side Authentication

```tsx
import { getCurrentUser, requireAuth, requireRole } from '@/lib/auth'

// Get current user (returns null if not authenticated)
const user = await getCurrentUser()

// Require authentication (throws if not authenticated)
const user = await requireAuth()

// Require specific role (throws if user doesn't have role)
const user = await requireRole('admin')
```

### Protected API Routes

```tsx
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()
    // User is authenticated, proceed with request
    return NextResponse.json({ data: 'protected data' })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

## File Structure

```
lib/
  supabase/
    client.ts          # Browser Supabase client
    server.ts          # Server Supabase client
    middleware.ts      # Middleware for session management
  auth.ts              # Server-side auth utilities

components/
  auth/
    auth-provider.tsx  # Client-side auth context

middleware.ts          # Next.js middleware for route protection

app/
  (auth)/
    login/
      page.tsx         # Login page
    register/
      page.tsx         # Registration page
    forgot-password/
      page.tsx         # Password reset request
    reset-password/
      page.tsx         # Password reset form

supabase/
  migrations/
    001_create_profiles_table.sql  # Database migration
```

## Security Features

- ✅ Row Level Security (RLS) enabled on profiles table
- ✅ Secure cookie-based session storage
- ✅ Automatic token refresh
- ✅ Protected API routes
- ✅ Role-based access control
- ✅ Password strength validation
- ✅ Secure password reset flow

## Next Steps

1. Set up your Supabase project and run the migration
2. Configure environment variables
3. Test authentication flows
4. Customize email templates in Supabase dashboard
5. Add additional user metadata fields as needed

## Troubleshooting

### "Invalid API key" error
- Check that your environment variables are set correctly
- Ensure you're using the `anon` key, not the `service_role` key

### "Profile not found" error
- Run the database migration to create the profiles table
- Check that the trigger is set up correctly

### Redirect loops
- Check that your Supabase URL configuration includes your site URL
- Verify middleware is not blocking necessary routes

### Email not sending
- Check Supabase email settings
- Verify SMTP configuration in Supabase dashboard
- Check spam folder

