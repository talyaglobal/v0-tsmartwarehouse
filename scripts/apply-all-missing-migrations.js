const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

const root = path.resolve(__dirname, '..');
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
const env = Object.assign({}, process.env, parseDotEnv(envPath));

let dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  console.error('Please set DATABASE_URL in .env.local');
  process.exit(1);
}

const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkTableExists(tableName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function checkPolicyExists(policyName, tableName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = $1 
        AND policyname = $2
      );
    `, [tableName, policyName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      );
    `, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function shouldSkipMigration(fileName) {
  // Check specific migration files to see if they've been applied
  const migrationChecks = {
    '001_create_profiles_table.sql': async () => await checkTableExists('profiles'),
    '001_initial_schema.sql': async () => await checkTableExists('users') || await checkTableExists('bookings'),
    '002_notification_preferences.sql': async () => await checkTableExists('notification_preferences'),
    '003_enable_realtime.sql': async () => {
      // Check if realtime is enabled (hard to check, but we can check for triggers)
      return await checkTableExists('bookings');
    },
    '003_payments_schema.sql': async () => await checkTableExists('payments'),
    '004_rls_policies.sql': async () => {
      // Check if any RLS policies exist
      const result = await client.query(`
        SELECT COUNT(*) as count FROM pg_policies WHERE schemaname = 'public' LIMIT 1
      `);
      return parseInt(result.rows[0].count) > 0;
    },
    '005_audit_logs.sql': async () => await checkTableExists('audit_logs'),
    '005_inventory_schema.sql': async () => await checkTableExists('inventory_items'),
    '005_storage_bucket_setup.sql': async () => {
      // Storage buckets are hard to check, skip this check
      return false;
    },
    '006_create_admin_user.sql': async () => {
      // Check if admin user exists
      const result = await client.query(`
        SELECT COUNT(*) as count FROM profiles WHERE role = 'super_admin' LIMIT 1
      `);
      return parseInt(result.rows[0].count) > 0;
    },
    '007_update_profiles_trigger.sql': async () => {
      // Check if trigger exists
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_trigger 
          WHERE tgname = 'update_profiles_updated_at'
        );
      `);
      return result.rows[0].exists;
    },
    '008_fix_bookings_customer_id_fkey.sql': async () => {
      // Check if foreign key exists
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.table_constraints 
          WHERE constraint_name LIKE '%customer_id%' 
          AND table_name = 'bookings'
        );
      `);
      return result.rows[0].exists;
    },
    '009_fix_claims_customer_id_fkey.sql': async () => {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.table_constraints 
          WHERE constraint_name LIKE '%customer_id%' 
          AND table_name = 'claims'
        );
      `);
      return result.rows[0].exists;
    },
    '010_create_companies_table.sql': async () => await checkTableExists('companies'),
    '011_add_company_id_to_profiles.sql': async () => await checkColumnExists('profiles', 'company_id'),
    '012_setup_docs_storage_policies.sql': async () => false, // Hard to check
    '013_add_company_fields.sql': async () => await checkColumnExists('companies', 'company_type'),
    '014_make_company_id_required.sql': async () => {
      const result = await client.query(`
        SELECT is_nullable FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'company_id'
      `);
      return result.rows.length > 0 && result.rows[0].is_nullable === 'NO';
    },
    '015_migrate_from_users_to_profiles.sql': async () => {
      // If users table still exists with data, migration might not be complete
      const result = await client.query(`
        SELECT COUNT(*) as count FROM users LIMIT 1
      `);
      return parseInt(result.rows[0].count) === 0;
    },
    '016_remove_company_column_from_profiles.sql': async () => {
      return !(await checkColumnExists('profiles', 'company'));
    },
    '025_create_notification_events_table.sql': async () => await checkTableExists('notification_events'),
    '026_create_notification_triggers.sql': async () => {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_trigger 
          WHERE tgname LIKE '%notification%'
        );
      `);
      return result.rows[0].exists;
    },
    '027_create_email_queue.sql': async () => await checkTableExists('email_queue'),
    '028_add_company_types.sql': async () => {
      // Check if company_types enum or table exists
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_type WHERE typname = 'company_type'
        );
      `);
      return result.rows[0].exists;
    },
    '029_add_warehouse_ownership.sql': async () => await checkColumnExists('warehouses', 'owner_id'),
    '030_create_warehouse_staff.sql': async () => await checkTableExists('warehouse_staff'),
    '031_create_pricing_tables.sql': async () => await checkTableExists('pricing_tiers'),
    '033_create_usage_tracking.sql': async () => await checkTableExists('usage_tracking'),
    '034_create_booking_modifications.sql': async () => await checkTableExists('booking_modifications'),
    '035_create_company_team.sql': async () => await checkTableExists('company_members'),
    '036_add_profiles_insert_policy.sql': async () => await checkPolicyExists('Users can insert own profile', 'profiles'),
    '038_disable_profile_trigger.sql': async () => {
      // Check if trigger is disabled
      const result = await client.query(`
        SELECT tgenabled FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
      `);
      return result.rows.length > 0 && result.rows[0].tgenabled === 'D';
    },
    '039_verify_company_admin_structure.sql': async () => {
      // This is a verification script, might have been run
      return true;
    },
    '040_add_company_member_consistency_check.sql': async () => {
      // Check if function exists
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_proc WHERE proname LIKE '%company_member%'
        );
      `);
      return result.rows[0].exists;
    },
    '041_set_company_creators_as_owners.sql': async () => {
      // This is a data migration, hard to verify
      return false;
    },
    '043_add_invitation_fullname_password.sql': async () => {
      return await checkColumnExists('company_invitations', 'full_name') && 
             await checkColumnExists('company_invitations', 'password');
    },
    '044_remove_company_members_add_invited_by.sql': async () => {
      return !(await checkTableExists('company_members')) && 
             await checkColumnExists('company_invitations', 'invited_by');
    },
    '045_remove_company_invitations.sql': async () => {
      return !(await checkTableExists('company_invitations'));
    },
    '046_make_company_id_nullable_for_invitations.sql': async () => {
      // If invitations table doesn't exist, skip
      if (!(await checkTableExists('company_invitations'))) return true;
      const result = await client.query(`
        SELECT is_nullable FROM information_schema.columns 
        WHERE table_name = 'company_invitations' AND column_name = 'company_id'
      `);
      return result.rows.length > 0 && result.rows[0].is_nullable === 'YES';
    },
    '047_remove_invitation_columns.sql': async () => {
      return !(await checkColumnExists('company_invitations', 'full_name'));
    },
    '048_remove_company_members_triggers.sql': async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count FROM pg_trigger WHERE tgname LIKE '%company_member%'
      `);
      return parseInt(result.rows[0].count) === 0;
    },
    '049_remove_company_members_notification_trigger.sql': async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count FROM pg_trigger WHERE tgname LIKE '%company_member%notification%'
      `);
      return parseInt(result.rows[0].count) === 0;
    },
    '050_add_invitation_password_back.sql': async () => {
      return await checkColumnExists('company_invitations', 'password');
    },
    '051_update_role_names.sql': async () => {
      // Check if new role names exist
      const result = await client.query(`
        SELECT COUNT(*) as count FROM profiles WHERE role IN ('super_admin', 'customer', 'worker') LIMIT 1
      `);
      return parseInt(result.rows[0].count) > 0;
    },
    '052_add_fcm_token_to_profiles.sql': async () => await checkColumnExists('profiles', 'fcm_token'),
    '053_create_services_and_orders.sql': async () => await checkTableExists('warehouse_services'),
    '054_add_warehouse_regions.sql': async () => await checkTableExists('warehouse_regions'),
    '055_enhance_inventory_tracking.sql': async () => {
      return await checkColumnExists('inventory_items', 'last_counted_at');
    },
    '056_add_capacity_tracking.sql': async () => await checkTableExists('capacity_tracking'),
    '057_add_payment_remaining_function.sql': async () => {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_proc WHERE proname = 'calculate_payment_remaining'
        );
      `);
      return result.rows[0].exists;
    },
    '058_add_stock_levels_tracking.sql': async () => await checkTableExists('stock_levels'),
    '059_add_pallet_label_fields.sql': async () => {
      return await checkColumnExists('inventory_items', 'label_printed_at');
    },
    '060_create_performance_tables.sql': async () => await checkTableExists('worker_performance'),
    '061_create_access_logs.sql': async () => await checkTableExists('access_logs'),
  };

  const checkFunction = migrationChecks[fileName];
  if (checkFunction) {
    try {
      return await checkFunction();
    } catch (error) {
      // If check fails, assume migration should be run
      return false;
    }
  }
  
  // If no specific check, don't skip
  return false;
}

async function applyMigrations() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const migrationsDir = path.join(root, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically

    console.log(`Found ${migrationFiles.length} migration files\n`);

    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      if (!migrationSQL.trim()) {
        console.log(`⚠️  Skipping ${file} (empty file)`);
        skippedCount++;
        continue;
      }

      // Check if migration should be skipped
      const shouldSkip = await shouldSkipMigration(file);
      if (shouldSkip) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        skippedCount++;
        continue;
      }

      console.log(`\n📄 Running migration: ${file}...`);
      
      try {
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        console.log(`✅ Migration ${file} applied successfully!`);
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Check if error is because object already exists (safe to ignore)
        const isAlreadyExistsError = 
          error.code === '42710' || // duplicate_object
          error.code === '42P07' || // duplicate_table
          error.code === '42723' || // duplicate_function
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('already has');

        if (isAlreadyExistsError) {
          console.log(`⚠️  Migration ${file} - some objects already exist (skipping): ${error.message.split('\n')[0]}`);
          skippedCount++;
        } else {
          console.error(`❌ Migration ${file} failed:`, error.message);
          if (error.code) {
            console.error('   Error code:', error.code);
          }
          if (error.detail) {
            console.error('   Detail:', error.detail);
          }
          errorCount++;
          // Continue with next migration instead of stopping
        }
      }
    }

    console.log(`\n\n📊 Migration Summary:`);
    console.log(`   ✅ Applied: ${appliedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📁 Total: ${migrationFiles.length}`);

    await client.end();
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

applyMigrations();

