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

async function runMigration() {
  try {
    const migrationPath = path.join(root, 'supabase', 'migrations', '042_create_company_role_enum.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📤 Executing migration 042 via Supabase REST API...\n');
    
    // Use Supabase REST API to execute SQL
    // Note: Supabase doesn't have a direct SQL execution endpoint
    // We'll use the REST API with service role key
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      console.log('\n⚠️  Supabase Management API does not support direct SQL execution.');
      console.log('   Please use Supabase SQL Editor instead:\n');
      console.log(`   1. Go to: ${supabaseUrl.replace('.supabase.co', '.supabase.com')}/project/gyodzimmhtecocscyeip/sql/new`);
      console.log(`   2. Copy contents of: supabase/migrations/042_create_company_role_enum.sql`);
      console.log('   3. Paste and click "Run"\n');
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Migration executed successfully!');
    console.log(result);
    
  } catch (error) {
    console.error('\n❌ Error executing migration:', error.message);
    console.log('\n📋 Please use manual method:');
    console.log(`   1. Go to: ${supabaseUrl.replace('.supabase.co', '.supabase.com')}/project/gyodzimmhtecocscyeip/sql/new`);
    console.log(`   2. Copy contents of: supabase/migrations/042_create_company_role_enum.sql`);
    console.log('   3. Paste and click "Run"');
    process.exit(1);
  }
}

runMigration();


