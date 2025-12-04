# Environment Variables Check

## 📋 Required Environment Variables

Based on the codebase analysis, here are the environment variables required for the application:

### ✅ Core Supabase Configuration (Required)

| Variable | Used In | Status | Description |
|----------|---------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All auth files, middleware | ✅ Required | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All auth files, middleware | ✅ Required | Your Supabase anonymous/public key |
| `NEXT_PUBLIC_SITE_URL` | Auth actions (email redirects) | ⚠️ Recommended | Site URL for email redirects (defaults to localhost:3000) |

### 🔐 Optional Supabase Configuration

| Variable | Used In | Status | Description |
|----------|---------|--------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations | ⚠️ Optional | Service role key for admin operations (server-side only) |

### 🔄 Other Configuration

| Variable | Used In | Status | Description |
|----------|---------|--------|-------------|
| `NEXT_PUBLIC_APP_URL` | next.config.mjs, CORS | ⚠️ Optional | App URL (defaults to localhost:3000) |
| `NODE_ENV` | Standard Next.js | ⚠️ Optional | Node environment (development/production) |

### ❌ Not Currently Used (Legacy/Unused)

| Variable | Status | Notes |
|----------|--------|-------|
| `DATABASE_URL` | ⚠️ Not used | Not referenced in codebase |
| `NEXTAUTH_URL` | ⚠️ Not used | Not using NextAuth, using Supabase Auth |
| `NEXTAUTH_SECRET` | ⚠️ Not used | Not using NextAuth, using Supabase Auth |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | ⚠️ Not used | Not referenced in codebase |

## 🔍 Current Configuration Status

### Files Found:
- ✅ `.env.example` - Example configuration file
- ✅ `.env.local` - Local environment file (contains actual values)

### Variable Inconsistencies Found:

1. **Site URL Variable Name Mismatch:**
   - Code uses: `NEXT_PUBLIC_SITE_URL` (in auth actions)
   - .env.example has: `NEXT_PUBLIC_APP_URL`
   - **Recommendation:** Use `NEXT_PUBLIC_SITE_URL` for consistency

2. **Missing Variables:**
   - `NEXT_PUBLIC_SITE_URL` - Not in .env.example but used in code

## 📝 Recommended .env.local Configuration

```env
# Core Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Site URL for Email Redirects (Recommended)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Service Role Key (for admin operations only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

## ✅ Verification Steps

To verify your environment is correctly configured:

1. **Check if Supabase variables are set:**
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. **Check if variables are loaded in Next.js:**
   - The app should run without errors
   - Authentication pages should load
   - No "Missing environment variable" errors in console

3. **Test authentication:**
   - Try to register a new user
   - Check if email verification link uses correct URL
   - Test password reset flow

## 🚨 Common Issues

### Issue: "Missing NEXT_PUBLIC_SUPABASE_URL environment variable"
**Solution:** Add the variable to `.env.local` file

### Issue: Email redirects go to wrong URL
**Solution:** Set `NEXT_PUBLIC_SITE_URL` to your actual site URL

### Issue: Service role key errors
**Solution:** Either:
- Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, OR
- The code will fallback to using anon key (with user session)

## 📚 Where Variables Are Used

### `NEXT_PUBLIC_SUPABASE_URL`
- `lib/supabase/server.ts` - Server-side client creation
- `lib/supabase/client.ts` - Client-side client creation
- `middleware.ts` - Route protection middleware
- `lib/supabase/middleware.ts` - Session management

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `lib/supabase/server.ts` - Server-side client creation
- `lib/supabase/client.ts` - Client-side client creation
- `middleware.ts` - Route protection middleware
- `lib/supabase/middleware.ts` - Session management

### `NEXT_PUBLIC_SITE_URL`
- `lib/auth/actions.ts` - Email verification redirect URL
- `lib/auth/actions.ts` - Password reset redirect URL

### `SUPABASE_SERVICE_ROLE_KEY`
- `lib/supabase/server.ts` - Admin operations (optional)

## 🔒 Security Notes

- ⚠️ **NEVER** commit `.env.local` to git (should be in .gitignore)
- ✅ `NEXT_PUBLIC_*` variables are exposed to the browser - safe for public keys
- 🔐 `SUPABASE_SERVICE_ROLE_KEY` should NEVER be exposed to the client
- 🔐 Service role key bypasses Row Level Security - use carefully

## 📖 Next Steps

1. Ensure `.env.local` has all required variables
2. Update `.env.example` to include `NEXT_PUBLIC_SITE_URL`
3. Test authentication flow
4. Verify email redirects work correctly

---

**Last Updated:** Based on current codebase analysis

