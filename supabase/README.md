# Database Setup Guide

This directory contains database migrations and setup files for the TSmart Warehouse Management System.

## Prerequisites

1. A Supabase project (create one at [supabase.com](https://supabase.com))
2. Supabase CLI installed (optional, for local development)

## Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gyodzimmhtecocscyeip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b2R6aW1taHRlY29jc2N5ZWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDg0NTAsImV4cCI6MjA3OTkyNDQ1MH0.4DpwSeAjPA2QuB80EIajEm78pF_geDW9znPK9_FeQMU
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b2R6aW1taHRlY29jc2N5ZWlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM0ODQ1MCwiZXhwIjoyMDc5OTI0NDUwfQ.Aru8NnkoMRVnbzXh6nFV-uvroCHCdALlAcXb3hEFRZM
```

## Running Migrations

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `migrations/001_initial_schema.sql`
4. Paste and run the SQL script

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Row Level Security (RLS)

RLS is enabled on all tables. You'll need to create policies based on your authentication setup. Example policies are commented in the migration file.

## Realtime Setup

After running `003_enable_realtime.sql`, you must also enable Realtime in your Supabase project settings:

1. Go to **Database** → **Replication** in Supabase dashboard
2. Toggle **Enable Realtime** to **ON**
3. Verify that `tasks`, `notifications`, `warehouse_halls`, and `bookings` tables are in the Realtime publication

See `DATABASE_COMPLETE_SETUP.md` Step 4.1 for detailed instructions.

## Next Steps

1. Run the migrations in order
2. **Enable Realtime in project settings** (see above)
3. Configure RLS policies
4. Seed initial data (optional)
5. Update API routes to use database functions from `lib/db/`

