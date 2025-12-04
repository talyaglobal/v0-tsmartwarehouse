# Quick Start: Database Setup

A quick reference for completing the database setup mentioned in Implementation Report (lines 273-275).

## 🚀 Three-Step Setup

### Step 1: Environment Variables ✅

Create `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
- Supabase Dashboard → Settings → API

### Step 2: Run Migrations ✅

1. Go to Supabase Dashboard → SQL Editor
2. Run these files **in order**:
   - `supabase/migrations/001_create_profiles_table.sql`
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_notification_preferences.sql`
   - `supabase/migrations/003_enable_realtime.sql`
   - `supabase/migrations/003_payments_schema.sql` (optional)

**How to run:**
- Copy file contents → Paste in SQL Editor → Click Run

### Step 3: Configure RLS Policies ✅

1. Go to Supabase Dashboard → SQL Editor
2. Run: `supabase/migrations/004_rls_policies.sql`

This creates all Row Level Security policies for:
- Profiles
- Bookings
- Invoices
- Tasks
- Incidents
- Claims
- Notifications
- Worker Shifts
- Warehouses

---

## ✅ Verify Setup

1. **Check Tables**: Supabase Dashboard → Table Editor
   - Should see 13+ tables

2. **Check Policies**: Supabase Dashboard → Authentication → Policies
   - Should see policies for each table

3. **Test Connection**: 
   ```bash
   npm run dev
   # Visit http://localhost:3000/register
   # Try registering a user
   ```

---

## 📚 Detailed Guides

For complete instructions, see:
- **`DATABASE_COMPLETE_SETUP.md`** - Full step-by-step guide
- **`DATABASE_SETUP.md`** - Original setup guide
- **`ENV_CHECK.md`** - Environment variable reference

---

## 🆘 Quick Fixes

**"Missing environment variable" error:**
→ Check `.env.local` exists and has correct variable names

**Migration fails:**
→ Tables might already exist - check Table Editor first

**RLS blocking queries:**
→ Run `004_rls_policies.sql` migration

**Can't connect:**
→ Verify Supabase project is active and URL is correct

---

**Status**: All setup files ready! Follow `DATABASE_COMPLETE_SETUP.md` for detailed instructions.

