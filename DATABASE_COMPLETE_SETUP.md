# Complete Database Setup Guide

This is a step-by-step guide to complete the database setup for TSmart Warehouse Management System, addressing:
1. Running database migrations
2. Configuring Row Level Security (RLS) policies
3. Setting up environment variables

## 📋 Quick Start Checklist

- [ ] Create Supabase project
- [ ] Get Supabase credentials
- [ ] Set up environment variables
- [ ] Run database migrations
- [ ] Configure RLS policies
- [ ] Verify setup

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **New Project**
3. Fill in project details:
   - **Name**: TSmart Warehouse (or your preferred name)
   - **Database Password**: Choose a strong password (save it securely)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
4. Click **Create new project**
5. Wait for project to finish provisioning (2-3 minutes)

---

## Step 2: Get Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values to a secure location:

   - **Project URL**
     ```
     https://xxxxxxxxxxxxx.supabase.co
     ```
   
   - **anon public key** (JWT token starting with `eyJ...`)
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
   
   - **service_role key** (JWT token starting with `eyJ...` - **KEEP THIS SECRET!**)
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

3. Also get your **Project Reference ID**:
   - Go to **Settings** → **General**
   - Copy the **Reference ID** (you'll need this for CLI setup)

---

## Step 3: Set Up Environment Variables

### 3.1 Create `.env.local` File

In your project root directory, create or edit `.env.local`:

```bash
# In your project root
touch .env.local
```

### 3.2 Add Required Variables

Open `.env.local` and add:

```env
# ============================================
# SUPABASE CONFIGURATION (Required)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# SITE CONFIGURATION (Required for Auth)
# ============================================
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ============================================
# OPTIONAL: Service Role Key
# ============================================
# Only needed for admin operations in server-side code
# DO NOT expose this in client-side code
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ============================================
# DEVELOPMENT
# ============================================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3.3 Replace Placeholder Values

Replace the placeholder values with your actual Supabase credentials:

- Replace `https://your-project-id.supabase.co` with your **Project URL**
- Replace `your-anon-key-here` with your **anon public key**
- Replace `your-service-role-key-here` with your **service_role key**
- Update `NEXT_PUBLIC_SITE_URL` if your local dev server runs on a different port

### 3.4 Verify Environment Variables

Check that your `.env.local` file is in the project root:

```bash
# From project root
ls -la .env.local
```

**Important**: 
- ✅ `.env.local` is automatically ignored by git (should be in `.gitignore`)
- ❌ **NEVER** commit `.env.local` to version control
- ⚠️ The `service_role` key bypasses RLS - keep it secure!

---

## Step 4: Run Database Migrations

### Option A: Using Supabase Dashboard (Recommended for First Setup)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run Migrations in Order**

   **Migration 1: Profiles Table**
   - Open `supabase/migrations/001_create_profiles_table.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run** (or `Ctrl+Enter` / `Cmd+Enter`)
   - ✅ Verify: Should see "Success. No rows returned"

   **Migration 2: Initial Schema**
   - Open `supabase/migrations/001_initial_schema.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**
   - ✅ Verify: Should see "Success. No rows returned"

   **Migration 3: Notification Preferences**
   - Open `supabase/migrations/002_notification_preferences.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**
   - ✅ Verify: Should see "Success. No rows returned"

   **Migration 4: Enable Realtime**
   - Open `supabase/migrations/003_enable_realtime.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**
   - ✅ Verify: Should see "Success. No rows returned"

   **Migration 5: Payments Schema** (Optional - if using payments)
   - Open `supabase/migrations/003_payments_schema.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**

### Option B: Using Supabase CLI (For Advanced Users)

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   # OR
   brew install supabase/tap/supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link Your Project**
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Settings → General → Reference ID)

4. **Run All Migrations**
   ```bash
   supabase db push
   ```

### Verify Migrations

1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - ✅ `profiles`
   - ✅ `users`
   - ✅ `warehouses`
   - ✅ `warehouse_floors`
   - ✅ `warehouse_halls`
   - ✅ `warehouse_zones`
   - ✅ `bookings`
   - ✅ `invoices`
   - ✅ `tasks`
   - ✅ `incidents`
   - ✅ `claims`
   - ✅ `notifications`
   - ✅ `notification_preferences`
   - ✅ `worker_shifts`
   - ✅ `payments` (if you ran payments migration)

---

## Step 5: Configure Row Level Security (RLS) Policies

### 5.1 Run RLS Policies Migration

1. **Open SQL Editor** in Supabase dashboard
2. **Open RLS Policies File**
   - Open `supabase/migrations/004_rls_policies.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**
   - ✅ Verify: Should see "Success. No rows returned"

### 5.2 Verify RLS is Enabled

1. Go to **Authentication** → **Policies** in Supabase dashboard
2. You should see policies for:
   - `profiles`
   - `bookings`
   - `invoices`
   - `tasks`
   - `incidents`
   - `claims`
   - `notifications`
   - `worker_shifts`
   - `warehouses` and related tables

### 5.3 Test RLS Policies

After creating test users, you can verify RLS is working:

```sql
-- Test: Check if you can see your own profile
SELECT * FROM profiles WHERE id = auth.uid();

-- Test: Check if admin can see all bookings
-- (Run as admin user)
SELECT * FROM bookings;
```

---

## Step 6: Configure Supabase Auth Settings

### 6.1 Email Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   ```
   http://localhost:3000/**
   https://your-production-domain.com/**
   ```
3. Add specific redirect URLs:
   ```
   http://localhost:3000/verify-email
   http://localhost:3000/reset-password
   ```

### 6.2 Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize templates if needed:
   - Confirm signup
   - Reset password
   - Magic link

---

## Step 7: Create Storage Bucket (For File Uploads)

If you're using file uploads (claim evidence, etc.):

1. Go to **Storage** in Supabase dashboard
2. Click **Create a new bucket**
3. Configure:
   - **Name**: `claim-evidence`
   - **Public bucket**: ✅ Enable (or configure RLS if private)
   - **File size limit**: 10MB
4. Click **Create bucket**

See `FILE_STORAGE_SETUP.md` for detailed storage configuration.

---

## Step 8: Verify Everything Works

### 8.1 Test Environment Variables

```bash
# Check if variables are loaded (will only work if server is running)
npm run dev
```

Check browser console for any "Missing environment variable" errors.

### 8.2 Test Database Connection

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test Authentication**
   - Go to http://localhost:3000/register
   - Try registering a new user
   - Check email for verification link

3. **Test API Endpoints**
   - Try accessing `/api/v1/bookings`
   - Should not return errors

### 8.3 Check Database Tables

1. Go to **Table Editor** in Supabase dashboard
2. Verify tables have correct structure
3. Check that `profiles` table has data after user registration

---

## 🚨 Troubleshooting

### "Missing NEXT_PUBLIC_SUPABASE_URL" Error

**Solution:**
1. Check `.env.local` exists in project root
2. Verify variable names match exactly (case-sensitive)
3. Restart dev server after adding variables:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Migration Fails with "relation already exists"

**Solution:**
- This means tables already exist
- Migration uses `CREATE TABLE IF NOT EXISTS` so it should be safe
- If you need to start fresh, drop tables first (⚠️ data loss):
  ```sql
  DROP TABLE IF EXISTS bookings CASCADE;
  -- Repeat for other tables
  ```

### RLS Blocking All Queries

**Solution:**
1. Verify RLS policies were created successfully
2. Check user is authenticated: `SELECT auth.uid();`
3. For development, you can temporarily check policies:
   ```sql
   -- Check if RLS is enabled
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

### Connection Timeout

**Solution:**
1. Verify Supabase project is active (not paused)
2. Check Project URL is correct
3. Ensure your IP is not blocked (Settings → Database → Connection Pooling)

### "Policy already exists" Error

**Solution:**
- Policies in `004_rls_policies.sql` use `CREATE POLICY` without `IF NOT EXISTS`
- If policy exists, drop it first:
  ```sql
  DROP POLICY IF EXISTS "policy_name" ON table_name;
  ```
- Or modify migration to use `CREATE POLICY IF NOT EXISTS` (PostgreSQL 9.5+)

---

## ✅ Completion Checklist

After completing all steps, verify:

- [ ] `.env.local` file exists with all required variables
- [ ] All migration files have been run successfully
- [ ] All tables appear in Table Editor
- [ ] RLS policies are visible in Authentication → Policies
- [ ] Can register a new user successfully
- [ ] User profile is automatically created in `profiles` table
- [ ] Email verification works
- [ ] Database queries work in API routes
- [ ] Storage bucket created (if using file uploads)

---

## 📚 Next Steps

After database setup is complete:

1. **Seed Initial Data** (Optional)
   - Create warehouse structure
   - Add test users for different roles
   - See `supabase/migrations/` for seed examples

2. **Configure Notifications**
   - Set up email provider (SendGrid/AWS SES)
   - Configure notification preferences
   - See `AUTH_SETUP.md` for details

3. **Test Application Features**
   - Create bookings
   - Submit claims with file uploads
   - Assign tasks to workers
   - Generate invoices

---

## 📖 Additional Resources

- **Detailed Migration Guide**: `DATABASE_SETUP.md`
- **Environment Variables**: `ENV_CHECK.md`
- **Authentication Setup**: `AUTH_SETUP.md`
- **File Storage Setup**: `FILE_STORAGE_SETUP.md`
- **Supabase Docs**: https://supabase.com/docs

---

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review Supabase dashboard logs:
   - **Logs** → **Postgres Logs** (database errors)
   - **Logs** → **API Logs** (API errors)
3. Verify environment variables are set correctly
4. Check migration files were run in correct order
5. Ensure RLS policies match your authentication setup

---

**Status**: ✅ Complete setup guide ready to use

