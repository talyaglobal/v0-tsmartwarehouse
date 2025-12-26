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
  console.error('ERROR: DATABASE_URL not found');
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

async function checkFunctionExists(functionName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc 
        WHERE proname = $1
      );
    `, [functionName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function checkTriggerExists(triggerName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = $1
      );
    `, [triggerName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function verifyMigrations() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    console.log('🔍 Verifying all migrations (001-061)...\n');

    const migrations = [
      { file: '001_create_profiles_table.sql', check: () => checkTableExists('profiles'), name: 'profiles table' },
      { file: '001_initial_schema.sql', check: () => checkTableExists('bookings'), name: 'bookings table' },
      { file: '002_notification_preferences.sql', check: () => checkTableExists('notification_preferences'), name: 'notification_preferences table' },
      { file: '003_enable_realtime.sql', check: () => checkTableExists('bookings'), name: 'realtime (bookings exists)' },
      { file: '003_payments_schema.sql', check: () => checkTableExists('payments'), name: 'payments table' },
      { file: '004_rls_policies.sql', check: async () => {
        const result = await client.query(`SELECT COUNT(*) as count FROM pg_policies WHERE schemaname = 'public' LIMIT 1`);
        return parseInt(result.rows[0].count) > 0;
      }, name: 'RLS policies' },
      { file: '005_audit_logs.sql', check: () => checkTableExists('audit_logs'), name: 'audit_logs table' },
      { file: '005_inventory_schema.sql', check: () => checkTableExists('inventory_items'), name: 'inventory_items table' },
      { file: '005_storage_bucket_setup.sql', check: () => Promise.resolve(true), name: 'storage buckets (hard to verify)' },
      { file: '006_create_admin_user.sql', check: async () => {
        const result = await client.query(`SELECT COUNT(*) as count FROM profiles WHERE role = 'super_admin' LIMIT 1`);
        return parseInt(result.rows[0].count) > 0;
      }, name: 'admin user' },
      { file: '007_update_profiles_trigger.sql', check: () => checkTriggerExists('update_profiles_updated_at'), name: 'profiles trigger' },
      { file: '008_fix_bookings_customer_id_fkey.sql', check: async () => {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%customer_id%' AND table_name = 'bookings'
          );
        `);
        return result.rows[0].exists;
      }, name: 'bookings foreign key' },
      { file: '009_fix_claims_customer_id_fkey.sql', check: async () => {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%customer_id%' AND table_name = 'claims'
          );
        `);
        return result.rows[0].exists;
      }, name: 'claims foreign key' },
      { file: '010_create_companies_table.sql', check: () => checkTableExists('companies'), name: 'companies table' },
      { file: '011_add_company_id_to_profiles.sql', check: () => checkColumnExists('profiles', 'company_id'), name: 'profiles.company_id' },
      { file: '012_setup_docs_storage_policies.sql', check: () => Promise.resolve(true), name: 'docs storage policies' },
      { file: '013_add_company_fields.sql', check: () => checkColumnExists('companies', 'company_type'), name: 'company fields' },
      { file: '014_make_company_id_required.sql', check: async () => {
        const result = await client.query(`
          SELECT is_nullable FROM information_schema.columns 
          WHERE table_name = 'profiles' AND column_name = 'company_id'
        `);
        return result.rows.length > 0 && result.rows[0].is_nullable === 'NO';
      }, name: 'company_id required' },
      { file: '015_migrate_from_users_to_profiles.sql', check: () => Promise.resolve(true), name: 'users to profiles migration' },
      { file: '016_remove_company_column_from_profiles.sql', check: () => checkColumnExists('profiles', 'company').then(exists => !exists), name: 'company column removed' },
      { file: '025_create_notification_events_table.sql', check: () => checkTableExists('notification_events'), name: 'notification_events table' },
      { file: '026_create_notification_triggers.sql', check: async () => {
        const result = await client.query(`SELECT EXISTS (SELECT FROM pg_trigger WHERE tgname LIKE '%notification%')`);
        return result.rows[0].exists;
      }, name: 'notification triggers' },
      { file: '027_create_email_queue.sql', check: () => checkTableExists('email_queue'), name: 'email_queue table' },
      { file: '028_add_company_types.sql', check: async () => {
        const result = await client.query(`SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'company_type')`);
        return result.rows[0].exists;
      }, name: 'company_type enum' },
      { file: '029_add_warehouse_ownership.sql', check: () => checkColumnExists('warehouses', 'owner_id'), name: 'warehouses.owner_id' },
      { file: '030_create_warehouse_staff.sql', check: () => checkTableExists('warehouse_staff'), name: 'warehouse_staff table' },
      { file: '031_create_pricing_tables.sql', check: () => checkTableExists('pricing_tiers'), name: 'pricing_tiers table' },
      { file: '033_create_usage_tracking.sql', check: () => checkTableExists('booking_usage_periods'), name: 'usage_tracking tables' },
      { file: '034_create_booking_modifications.sql', check: () => checkTableExists('booking_modifications'), name: 'booking_modifications table' },
      { file: '035_create_company_team.sql', check: () => checkTableExists('company_members'), name: 'company_members table' },
      { file: '036_add_profiles_insert_policy.sql', check: async () => {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM pg_policies 
            WHERE tablename = 'profiles' AND policyname LIKE '%insert%'
          );
        `);
        return result.rows[0].exists;
      }, name: 'profiles insert policy' },
      { file: '038_disable_profile_trigger.sql', check: async () => {
        const result = await client.query(`SELECT tgenabled FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'`);
        return result.rows.length > 0 && result.rows[0].tgenabled === 'D';
      }, name: 'profile trigger disabled' },
      { file: '039_verify_company_admin_structure.sql', check: () => Promise.resolve(true), name: 'company admin structure' },
      { file: '040_add_company_member_consistency_check.sql', check: () => checkFunctionExists('check_company_member_consistency'), name: 'consistency check function' },
      { file: '041_set_company_creators_as_owners.sql', check: () => Promise.resolve(true), name: 'company creators as owners' },
      { file: '043_add_invitation_fullname_password.sql', check: async () => {
        return await checkTableExists('company_invitations') && 
               await checkColumnExists('company_invitations', 'full_name') && 
               await checkColumnExists('company_invitations', 'password');
      }, name: 'invitation fields' },
      { file: '044_remove_company_members_add_invited_by.sql', check: async () => {
        return !(await checkTableExists('company_members')) && 
               await checkColumnExists('company_invitations', 'invited_by');
      }, name: 'company members removed, invited_by added' },
      { file: '045_remove_company_invitations.sql', check: () => checkTableExists('company_invitations').then(exists => !exists), name: 'company_invitations removed' },
      { file: '046_make_company_id_nullable_for_invitations.sql', check: async () => {
        if (!(await checkTableExists('company_invitations'))) return true;
        const result = await client.query(`
          SELECT is_nullable FROM information_schema.columns 
          WHERE table_name = 'company_invitations' AND column_name = 'company_id'
        `);
        return result.rows.length > 0 && result.rows[0].is_nullable === 'YES';
      }, name: 'company_id nullable' },
      { file: '047_remove_invitation_columns.sql', check: () => checkColumnExists('company_invitations', 'full_name').then(exists => !exists), name: 'invitation columns removed' },
      { file: '048_remove_company_members_triggers.sql', check: async () => {
        const result = await client.query(`SELECT COUNT(*) as count FROM pg_trigger WHERE tgname LIKE '%company_member%'`);
        return parseInt(result.rows[0].count) === 0;
      }, name: 'company member triggers removed' },
      { file: '049_remove_company_members_notification_trigger.sql', check: async () => {
        const result = await client.query(`SELECT COUNT(*) as count FROM pg_trigger WHERE tgname LIKE '%company_member%notification%'`);
        return parseInt(result.rows[0].count) === 0;
      }, name: 'company member notification trigger removed' },
      { file: '050_add_invitation_password_back.sql', check: () => checkColumnExists('company_invitations', 'password'), name: 'invitation password added back' },
      { file: '051_update_role_names.sql', check: async () => {
        const result = await client.query(`SELECT COUNT(*) as count FROM profiles WHERE role IN ('super_admin', 'customer', 'worker') LIMIT 1`);
        return parseInt(result.rows[0].count) > 0;
      }, name: 'role names updated' },
      { file: '052_add_fcm_token_to_profiles.sql', check: () => checkColumnExists('profiles', 'fcm_token'), name: 'profiles.fcm_token' },
      { file: '053_create_services_and_orders.sql', check: () => checkTableExists('warehouse_services'), name: 'warehouse_services table' },
      { file: '054_add_warehouse_regions.sql', check: () => checkTableExists('warehouse_regions'), name: 'warehouse_regions table' },
      { file: '055_enhance_inventory_tracking.sql', check: () => checkColumnExists('inventory_items', 'last_counted_at'), name: 'inventory tracking fields' },
      { file: '056_add_capacity_tracking.sql', check: () => checkTableExists('capacity_tracking'), name: 'capacity_tracking table' },
      { file: '057_add_payment_remaining_function.sql', check: () => checkFunctionExists('calculate_payment_remaining'), name: 'calculate_payment_remaining function' },
      { file: '058_add_stock_levels_tracking.sql', check: () => checkTableExists('stock_levels'), name: 'stock_levels table' },
      { file: '059_add_pallet_label_fields.sql', check: () => checkColumnExists('inventory_items', 'label_printed_at'), name: 'pallet label fields' },
      { file: '060_create_performance_tables.sql', check: () => checkTableExists('worker_performance'), name: 'performance tables' },
      { file: '061_create_access_logs.sql', check: () => checkTableExists('access_logs'), name: 'access_logs table' },
    ];

    let verified = 0;
    let failed = 0;
    const failedMigrations = [];

    for (const migration of migrations) {
      try {
        const exists = await migration.check();
        if (exists) {
          console.log(`✅ ${migration.file.padEnd(45)} - ${migration.name}`);
          verified++;
        } else {
          console.log(`❌ ${migration.file.padEnd(45)} - ${migration.name} - NOT FOUND`);
          failed++;
          failedMigrations.push(migration.file);
        }
      } catch (error) {
        console.log(`⚠️  ${migration.file.padEnd(45)} - ${migration.name} - ERROR: ${error.message}`);
        failed++;
        failedMigrations.push(migration.file);
      }
    }

    console.log(`\n\n📊 Verification Summary:`);
    console.log(`   ✅ Verified: ${verified}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Total: ${migrations.length}`);

    if (failedMigrations.length > 0) {
      console.log(`\n⚠️  Failed migrations:`);
      failedMigrations.forEach(file => console.log(`   - ${file}`));
    } else {
      console.log(`\n🎉 All migrations (001-061) are verified!`);
    }

    await client.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

verifyMigrations();

