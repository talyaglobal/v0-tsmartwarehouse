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

### 🚨 CRITICAL: Automatic Migration Push Policy

**The AI Assistant (Auto) is responsible for ALL Supabase migration operations. Users should NEVER manually push migrations.**

**See `SUPABASE_MIGRATION_AUTOMATION.md for complete details.**

**Key Points:**
- ✅ AI automatically pushes migrations when created
- ✅ AI tracks which migrations are applied
- ✅ AI handles all error recovery
- ❌ Users should NEVER run `supabase db push` manually
- ❌ Users should NEVER apply migrations via Supabase Dashboard

**The AI will:**
1. Automatically detect new migration files
2. Check which migrations are already applied
3. Push only new/unapplied migrations
4. Handle all errors and retry automatically
5. Track migration status continuously

### Migration Status

- ✅ All migrations 001-107 are applied
- ✅ Migration 107 (PostGIS + Enhanced Marketplace Tables) - Applied successfully
- Future migrations will be automatically pushed by the AI

**Note**: Users should never run `supabase db push` manually. The AI handles all migration operations automatically.

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

