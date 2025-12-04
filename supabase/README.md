# Database Setup Guide

This directory contains database migrations and setup files for the TSmart Warehouse Management System.

## Prerequisites

1. A Supabase project (create one at [supabase.com](https://supabase.com))
2. Supabase CLI installed (optional, for local development)

## Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
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

## Database Schema Overview

The initial schema includes:

- **users** - User accounts with roles (admin, customer, worker)
- **warehouses** - Warehouse information
- **warehouse_floors** - Floor configuration
- **warehouse_halls** - Hall configuration
- **warehouse_zones** - Zone definitions
- **bookings** - Customer bookings
- **invoices** - Billing and invoicing
- **tasks** - Worker task management
- **incidents** - Incident tracking
- **claims** - Customer claims
- **notifications** - User notifications
- **worker_shifts** - Worker shift tracking

## Row Level Security (RLS)

RLS is enabled on all tables. You'll need to create policies based on your authentication setup. Example policies are commented in the migration file.

## Next Steps

1. Run the migration
2. Configure RLS policies
3. Seed initial data (optional)
4. Update API routes to use database functions from `lib/db/`

