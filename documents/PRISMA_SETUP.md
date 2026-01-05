# Prisma Setup Guide

This guide explains how to set up Prisma for the TSmart Warehouse Marketplace project.

## ⚠️ Current Status

**We are currently using Supabase for all database operations.**

Prisma code is prepared and ready for future migration, but **not active** right now.

- ✅ **Active**: Supabase implementation (`warehouse-search-supabase.ts`)
- 📦 **Prepared**: Prisma implementation (`warehouse-search.ts`) - ready for future use

See `PRISMA_MIGRATION_PLAN.md` for migration details.

## Quick Start (When Ready to Use Prisma)

**Just run one command after adding DATABASE_URL:**

```bash
npm run prisma:setup
```

This automatically runs `npx prisma db pull` and `npx prisma generate` for you!

## Prerequisites

1. Prisma and @prisma/client are already installed (see `package.json`)
2. You have access to your Supabase database
3. You have the DATABASE_URL connection string

## Getting Your DATABASE_URL

For Supabase, you can find your connection string in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Under **Connection string**, select **URI**
4. Copy the connection string (it looks like: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`)

Alternatively, you can construct it manually:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## Setup Steps

### 1. Add DATABASE_URL to Environment

Add the DATABASE_URL to your `.env.local` file:

```env
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

**Note:** The `pgbouncer=true&connection_limit=1` parameters are important for Supabase connection pooling.

### 2. Automated Setup (Recommended)

Run the automated setup script that will do everything for you:

```bash
npm run prisma:setup
```

This single command will automatically:
- ✅ Pull the database schema (`npx prisma db pull`)
- ✅ Generate the Prisma client (`npx prisma generate`)

**That's it!** No need to run commands manually.

### Manual Setup (Alternative)

If you prefer to run commands manually:

```bash
# Step 1: Pull database schema
npm run prisma:pull

# Step 2: Generate Prisma client
npm run prisma:generate
```

Or using npx directly:

```bash
npx prisma db pull
npx prisma generate
```

### 4. Verify Setup

You can verify the setup by checking:

1. `prisma/schema.prisma` - Should contain all your database tables
2. `lib/generated/prisma` - Should contain the generated Prisma client
3. Import and use Prisma in your code:

```typescript
import { prisma } from '@/lib/prisma/client'

// Example usage
const warehouses = await prisma.warehouses.findMany()
```

## Important Notes

### Coexistence with Supabase

- **Supabase Client**: Still used for authentication, realtime subscriptions, and storage
- **Prisma Client**: Used for data queries in marketplace features (search, listings, etc.)

This hybrid approach allows:
- Gradual migration from Supabase to Prisma
- Keeping Supabase features (auth, realtime) intact
- Better type safety and developer experience with Prisma

### Connection Pooling

Supabase uses PgBouncer for connection pooling. Make sure your DATABASE_URL includes:
- `pgbouncer=true` parameter
- `connection_limit=1` parameter

For direct connections (migrations), use a separate connection string without pgbouncer.

### Schema Updates

When you add new migrations to Supabase:

1. Run the migration in Supabase (via Dashboard or CLI)
2. Run `npm run prisma:setup` to automatically update schema and regenerate client

Or manually:
```bash
npm run prisma:pull    # Update schema
npm run prisma:generate # Regenerate client
```

## Troubleshooting

### Error: Can't reach database server

- Check your DATABASE_URL is correct
- Verify your Supabase project is active
- Check if your IP is whitelisted (if using IP restrictions)

### Error: Schema drift detected

If Prisma detects differences between your schema and database:
- Review the differences
- Update your Supabase migrations to match, OR
- Update Prisma schema manually and run `npx prisma db push` (not recommended for production)

### Type Errors After Generation

If you see TypeScript errors after generating:
1. Make sure `npx prisma generate` completed successfully
2. Restart your TypeScript server in your IDE
3. Check that `lib/generated/prisma` directory exists

## Next Steps

After setup:
1. The marketplace search service (`lib/services/warehouse-search.ts`) will use Prisma
2. New marketplace features will use Prisma for type-safe queries
3. Existing Supabase queries will continue to work

For questions or issues, refer to:
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)

