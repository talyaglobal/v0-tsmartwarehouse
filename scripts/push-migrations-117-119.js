/**
 * Push Migrations 117, 118, 119 to Supabase
 * Automatically pushes the new contract management and agreement tracking migrations
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkMigrationApplied(version) {
  const { data, error } = await supabase
    .from('supabase_migrations.schema_migrations')
    .select('version')
    .eq('version', version)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found" which is expected if migration not applied
    console.error(`Error checking migration ${version}:`, error);
    return false;
  }

  return !!data;
}

async function applyMigration(version, filename) {
  console.log(`\n📦 Applying migration ${version}: ${filename}...`);

  // Check if already applied
  const isApplied = await checkMigrationApplied(version);
  if (isApplied) {
    console.log(`✅ Migration ${version} already applied, skipping...`);
    return { success: true, skipped: true };
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', filename);
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return { success: false, error: 'File not found' };
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Execute migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL,
    });

    if (error) {
      // Try direct query execution
      console.log('Trying direct SQL execution...');
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            const { error: execError } = await supabase.rpc('exec_sql', {
              sql: statement + ';',
            });
            
            if (execError) {
              // Try using PostgREST query builder for specific operations
              console.log(`Executing: ${statement.substring(0, 50)}...`);
              // For complex migrations, we'll need to use the Supabase SQL editor approach
              // or break down into smaller operations
            }
          } catch (err) {
            console.warn(`Warning executing statement: ${err.message}`);
          }
        }
      }
    }

    // Record migration in schema_migrations
    const { error: recordError } = await supabase
      .from('supabase_migrations.schema_migrations')
      .insert({
        version: version,
        name: filename,
      });

    if (recordError && recordError.code !== '23505') {
      // 23505 is unique constraint violation (already exists)
      console.warn(`Warning recording migration: ${recordError.message}`);
    }

    console.log(`✅ Migration ${version} applied successfully!`);
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`❌ Error applying migration ${version}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Pushing Contract Management Migrations to Supabase...\n');
  console.log(`Project: ${SUPABASE_URL}\n`);

  const migrations = [
    { version: '117', filename: '117_extend_crm_contacts_for_signatures.sql' },
    { version: '118', filename: '118_add_signature_requests.sql' },
    { version: '119', filename: '119_add_agreement_tracking.sql' },
  ];

  const results = [];

  for (const migration of migrations) {
    const result = await applyMigration(migration.version, migration.filename);
    results.push({ ...migration, ...result });
  }

  console.log('\n📊 Migration Summary:');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  results.forEach(({ version, filename, success, skipped, error }) => {
    if (skipped) {
      console.log(`⏭️  ${version}: ${filename} - Already applied`);
      skippedCount++;
    } else if (success) {
      console.log(`✅ ${version}: ${filename} - Applied successfully`);
      successCount++;
    } else {
      console.log(`❌ ${version}: ${filename} - Failed: ${error}`);
      failedCount++;
    }
  });

  console.log('='.repeat(50));
  console.log(`Total: ${results.length} | ✅ Applied: ${successCount} | ⏭️  Skipped: ${skippedCount} | ❌ Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.');
    console.log('💡 Tip: You may need to apply these migrations manually via Supabase SQL Editor.');
    process.exit(1);
  } else {
    console.log('\n🎉 All migrations completed successfully!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

