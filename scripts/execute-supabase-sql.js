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

async function executeSQL() {
  try {
    // Read the combined migration file
    const combinedFile = path.join(root, 'supabase', 'all_migrations_combined.sql');
    if (!fs.existsSync(combinedFile)) {
      console.error('ERROR: Combined migration file not found. Run: npm run db:migrate:prepare');
      process.exit(1);
    }

    const sql = fs.readFileSync(combinedFile, 'utf8');
    
    console.log('📤 Executing migrations via Supabase Management API...\n');
    
    // Use Supabase Management API
    // Note: Supabase doesn't have a direct SQL execution endpoint in Management API
    // We need to use the REST API with service role key
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // Try alternative method - execute via pg REST API
      console.log('⚠️  Direct API method not available. Using alternative approach...\n');
      
      // Split SQL into statements and execute one by one
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && s.length > 10);
      
      console.log(`📝 Found ${statements.length} SQL statements to execute`);
      console.log('\n⚠️  Supabase Management API does not support direct SQL execution.');
      console.log('   Please use one of these methods:\n');
      console.log('   METHOD 1: Supabase Dashboard (Recommended)');
      console.log(`   1. Go to: https://app.supabase.com/project/${projectRef}/sql/new`);
      console.log(`   2. Copy contents of: supabase/all_migrations_combined.sql`);
      console.log('   3. Paste and click "Run"\n');
      console.log('   METHOD 2: Use Supabase CLI');
      console.log('   1. Install: npm install -g supabase');
      console.log(`   2. Link: supabase link --project-ref ${projectRef}`);
      console.log('   3. Push: supabase db push\n');
      
      process.exit(0);
    }

    const result = await response.json();
    console.log('✅ Migrations executed successfully!');
    console.log(result);
    
  } catch (error) {
    console.error('\n❌ Error executing migrations:', error.message);
    console.log('\n📋 Please use manual method:');
    console.log(`   1. Go to: https://app.supabase.com/project/${projectRef}/sql/new`);
    console.log(`   2. Copy contents of: supabase/all_migrations_combined.sql`);
    console.log('   3. Paste and click "Run"');
    process.exit(1);
  }
}

executeSQL();

