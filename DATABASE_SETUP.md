# Database Setup and Migration Guide

This guide will walk you through setting up the database for the TSmart Warehouse Management System using Supabase (PostgreSQL).

## Prerequisites

Before you begin, ensure you have:

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project in your Supabase dashboard
3. **Environment Variables**: Set up your `.env.local` file (see `ENV_SETUP.md` for details)

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (JWT token starting with `eyJ...`)
   - **service_role key** (JWT token starting with `eyJ...` - keep this secret!)

## Step 2: Configure Environment Variables

Create a `.env.local` file in your project root (or copy from `.env.example`):

```env
# Required: Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Required: Application Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
```

See `.env.example` for all available environment variables.

## Step 3: Run Database Migrations

You have two options for running migrations:

### Option 1: Using Supabase Dashboard (Recommended for First Setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open the migration file: `supabase/migrations/001_initial_schema.sql`
5. Copy the entire contents of the file
6. Paste into the SQL Editor
7. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**Note:** The migration file includes:
- All database tables
- Indexes for performance
- Foreign key relationships
- Row Level Security (RLS) enabled
- Automatic `updated_at` triggers

### Option 2: Using Supabase CLI (For Advanced Users)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Supabase dashboard → Settings → General → Reference ID)

3. Run migrations:
   ```bash
   supabase db push
   ```

## Step 4: Verify Migration Success

After running the migration, verify that all tables were created:

1. Go to **Table Editor** in your Supabase dashboard
2. You should see the following tables:
   - `users`
   - `warehouses`
   - `warehouse_floors`
   - `warehouse_halls`
   - `warehouse_zones`
   - `bookings`
   - `invoices`
   - `tasks`
   - `incidents`
   - `claims`
   - `notifications`
   - `worker_shifts`
   - `profiles` (created by authentication setup)

## Step 5: Configure Row Level Security (RLS)

RLS is enabled on all tables. You'll need to create policies based on your security requirements.

### Basic RLS Policies

1. Go to **Authentication** → **Policies** in your Supabase dashboard
2. For each table, create policies as needed. Example policies are available in the migration file comments.

### Example: Allow users to read their own bookings

```sql
-- Enable RLS on bookings table (already done in migration)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bookings
CREATE POLICY "Users can view own bookings"
ON bookings FOR SELECT
USING (customer_id = auth.uid());

-- Policy: Users can create their own bookings
CREATE POLICY "Users can create own bookings"
ON bookings FOR INSERT
WITH CHECK (customer_id = auth.uid());
```

### Quick RLS Setup Script

For development, you can temporarily disable RLS on specific tables:

```sql
-- ⚠️ Only for development! Not recommended for production
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
```

## Step 6: Seed Initial Data (Optional)

You may want to seed your database with initial warehouse configuration and test data:

1. Go to **SQL Editor** in Supabase dashboard
2. Create a seed script (example provided below)

### Example Seed Script

```sql
-- Insert default warehouse
INSERT INTO warehouses (id, name, address, city, state, zip_code, total_sq_ft)
VALUES (
  'wh-001',
  'TSmart Warehouse - Main Facility',
  '123 Warehouse Street',
  'City',
  'State',
  '12345',
  240000
);

-- Insert warehouse floors (3 floors)
INSERT INTO warehouse_floors (warehouse_id, floor_number, total_sq_ft)
VALUES
  ('wh-001', 1, 80000),
  ('wh-001', 2, 80000),
  ('wh-001', 3, 80000);
```

See `supabase/migrations/` for more detailed seed data examples.

## Step 7: Verify Database Connection

Test your database connection:

1. Run the environment checker:
   ```bash
   npm run check-env
   ```

2. Start your development server:
   ```bash
   npm run dev
   ```

3. Test an API endpoint that uses the database (e.g., `/api/v1/bookings`)

## Troubleshooting

### Migration Fails with "relation already exists"

This means some tables already exist. You can either:
- Drop existing tables and re-run the migration (⚠️ data loss)
- Use `CREATE TABLE IF NOT EXISTS` (already in migration file)

### "Missing NEXT_PUBLIC_SUPABASE_URL" Error

- Verify your `.env.local` file exists in the project root
- Check that variable names match exactly (case-sensitive)
- Restart your development server after adding environment variables

### Connection Timeout

- Verify your Supabase project URL is correct
- Check that your Supabase project is active (not paused)
- Ensure your IP is not blocked in Supabase project settings

### RLS Blocking Queries

- Check that RLS policies are configured correctly
- For development, you can temporarily disable RLS (not recommended for production)
- Ensure authenticated requests include proper JWT tokens

### Database Functions Not Working

- Verify that all migrations have been run successfully
- Check that table names match exactly (case-sensitive in PostgreSQL)
- Ensure foreign key relationships are correct

## Next Steps

After completing the database setup:

1. ✅ Configure authentication (see `AUTH_SETUP.md`)
2. ✅ Test API endpoints with real database queries
3. ✅ Set up RLS policies based on your security requirements
4. ✅ Seed initial data if needed
5. ✅ Configure backup and recovery strategies

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- Project-specific documentation:
  - `ENV_SETUP.md` - Environment variable configuration
  - `AUTH_SETUP.md` - Authentication setup guide
  - `BACKEND_INFRASTRUCTURE.md` - Backend infrastructure overview

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase dashboard logs (Logs → Postgres Logs)
3. Check application error logs
4. Verify environment variables are correctly set

