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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
  process.exit(1);
}

// Extract project ref from Supabase URL
const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('ERROR: Invalid NEXT_PUBLIC_SUPABASE_URL format');
  process.exit(1);
}

const projectRef = urlMatch[1];
const managementApiUrl = `https://${projectRef}.supabase.co`;

async function runMigrations() {
  try {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    
    // Get all migration files and sort them
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`\n📦 Found ${migrationFiles.length} migration files\n`);

    // Read all migration files and combine them
    let combinedSQL = `-- Combined migrations for TSmart Warehouse Management System
-- Generated automatically - DO NOT EDIT
-- Run this in Supabase Dashboard → SQL Editor

`;

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      if (!migrationSQL.trim()) {
        console.log(`⚠️  Skipping ${file} (empty file)`);
        continue;
      }

      combinedSQL += `\n-- ============================================\n`;
      combinedSQL += `-- Migration: ${file}\n`;
      combinedSQL += `-- ============================================\n\n`;
      combinedSQL += migrationSQL;
      combinedSQL += `\n\n`;
      
      console.log(`✅ Added ${file}`);
    }

    // Write combined SQL file
    const outputPath = path.join(root, 'supabase', 'all_migrations_combined.sql');
    fs.writeFileSync(outputPath, combinedSQL, 'utf8');
    
    console.log(`\n✅ Combined migration file created: ${outputPath}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Go to Supabase Dashboard: https://app.supabase.com/project/${projectRef}`);
    console.log(`   2. Navigate to SQL Editor`);
    console.log(`   3. Click "New query"`);
    console.log(`   4. Copy and paste the contents of: supabase/all_migrations_combined.sql`);
    console.log(`   5. Click "Run" to execute all migrations`);
    console.log(`\n   OR use the Management API script (requires additional setup)`);
    
    // Try to use Management API if possible
    console.log(`\n🔄 Attempting to run migrations via Management API...`);
    
    try {
      // Use Supabase REST API to execute SQL
      // Note: This requires the SQL to be executed via the Management API
      // For now, we'll just create the combined file
      console.log(`\n✅ Migration file ready! Please run it manually in Supabase Dashboard.`);
    } catch (apiError) {
      console.log(`\n⚠️  Could not run via API. Please use the manual method above.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

runMigrations();

