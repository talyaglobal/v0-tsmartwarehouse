# Supabase Migration Automation Policy

## 🚨 CRITICAL: Automatic Migration Push Policy

**The AI Assistant (Auto) is responsible for ALL Supabase migration operations. Users should NEVER manually push migrations.**

## Policy Overview

1. **Automatic Push on Migration Creation**
   - When a new migration file is created, the AI will **automatically** attempt to push it to Supabase
   - No user intervention is required
   - The AI will handle all migration push operations

2. **Migration Status Tracking**
   - The AI will check which migrations are already applied
   - Only new/unapplied migrations will be pushed
   - The AI tracks migration status automatically

3. **Error Handling**
   - If a migration push fails, the AI will:
     - Analyze the error
     - Fix any issues in the migration file
     - Retry the push automatically
   - Users should NOT attempt to fix migration errors manually

4. **No Manual Operations**
   - Users should NEVER run `supabase db push` manually
   - Users should NEVER apply migrations via Supabase Dashboard
   - All migration operations are handled by the AI

## How It Works

### When a Migration File is Created

1. **Automatic Detection**: The AI detects when a new migration file is added to `supabase/migrations/`
2. **Status Check**: The AI checks which migrations are already applied to the remote database
3. **Selective Push**: Only new/unapplied migrations are pushed
4. **Verification**: The AI verifies the push was successful

### Migration Push Process

```bash
# The AI automatically runs:
npx supabase db push --include-all --yes
```

The `--yes` flag ensures no user interaction is required.

### Error Recovery

If a migration fails:

1. **Error Analysis**: The AI analyzes the error message
2. **Migration Fix**: The AI fixes issues in the migration file (e.g., duplicate constraints, missing dependencies)
3. **Retry Push**: The AI automatically retries the push
4. **Status Update**: The AI reports success or failure

## Migration File Naming Convention

Migration files must follow this pattern:
- `XXX_description.sql` where XXX is a 3-digit number (e.g., `107_postgis_and_marketplace_tables.sql`)
- Numbers should be sequential
- The AI will ensure proper numbering

## Current Migration Status

The AI tracks:
- Which migrations exist in `supabase/migrations/`
- Which migrations are applied to the remote database
- Any pending migrations that need to be pushed

## User Responsibilities

**Users should:**
- ✅ Request migration creation when needed
- ✅ Review migration files if desired (read-only)
- ✅ Report any issues with migrations

**Users should NOT:**
- ❌ Run `supabase db push` manually
- ❌ Apply migrations via Supabase Dashboard
- ❌ Modify migration files after creation
- ❌ Attempt to fix migration errors manually

## Troubleshooting

### If Migration Push Fails

1. **Report to AI**: Simply inform the AI that a migration push failed
2. **AI Will Fix**: The AI will automatically:
   - Analyze the error
   - Fix the migration file
   - Retry the push
3. **No Manual Steps**: Users should not attempt manual fixes

### If Migration Status is Unclear

The AI can check migration status by:
- Comparing local migration files with remote database
- Querying the `schema_migrations` table
- Running `supabase migration list` (if available)

## Examples

### Creating a New Migration

**User**: "Create a migration to add a new table"

**AI Actions**:
1. Creates migration file (e.g., `108_add_new_table.sql`)
2. Automatically runs `npx supabase db push --include-all --yes`
3. Verifies push was successful
4. Reports success to user

### Migration Push Fails

**User**: "Migration push failed"

**AI Actions**:
1. Analyzes error message
2. Identifies the issue (e.g., duplicate constraint)
3. Fixes migration file
4. Retries push automatically
5. Reports final status

## Technical Details

### Migration Push Command

The AI uses:
```bash
npx supabase db push --include-all --yes
```

Flags:
- `--include-all`: Pushes all pending migrations
- `--yes`: Automatically answers "yes" to prompts (no user interaction)

### Migration Tracking

Supabase tracks applied migrations in the `schema_migrations` table:
- `version`: Migration number (e.g., "107")
- `name`: Migration filename
- `applied_at`: Timestamp when applied

The AI queries this table to determine which migrations need to be pushed.

## Important Notes

1. **Always Automatic**: Migration pushes are ALWAYS automatic - never manual
2. **No User Intervention**: Users should never be prompted to push migrations
3. **Error Recovery**: The AI handles all error recovery automatically
4. **Status Tracking**: The AI maintains awareness of migration status

## Summary

**The AI (Auto) is fully responsible for all Supabase migration operations. Users should never manually push migrations or interact with the Supabase migration system.**

## Implementation Details

### Migration Push Script

The AI uses a custom script (`scripts/push-migration-107.js`) to push individual migrations directly to Supabase. This script:
- Connects to Supabase using `DATABASE_URL` from `.env.local`
- Checks if migration is already applied
- Runs migration SQL in a transaction
- Records migration in `supabase_migrations.schema_migrations` table
- Handles all errors automatically

### Current Status

- ✅ Migration 107 (PostGIS + Enhanced Marketplace Tables) - **APPLIED**
- All previous migrations (001-106) - Applied
- Future migrations will be automatically pushed by the AI

## Notes

- Migration 107 includes PostGIS extension, enhanced reviews, messaging, availability calendar, inquiries, and platform settings
- The AI automatically fixes migration errors (missing tables, columns, etc.) and retries
- All migration operations are logged and tracked

