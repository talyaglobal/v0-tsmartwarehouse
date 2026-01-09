const { spawnSync } = require('child_process');
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
const dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  process.exit(1);
}

console.log('Loaded env from:', envPath);
console.log('Using DATABASE_URL:', dbUrl ? dbUrl.replace(/(:).*@(.*)/, ':*****@$2') : 'not set');

// Migrations that are already applied (from migration list output)
const appliedMigrations = new Set(['001', '104', '107', '115', '116', '117', '118', '119']);

// Get all migration files
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

// Filter out already applied migrations
const missingMigrations = migrationFiles.filter(file => {
  // Extract migration number from filename
  const match = file.match(/^(\d+)_|^(\d{14})_/);
  if (!match) return true; // Include if can't parse
  
  const migrationNum = match[1] || match[2];
  return !appliedMigrations.has(migrationNum);
});

if (missingMigrations.length === 0) {
  console.log('✅ All migrations are already applied!');
  process.exit(0);
}

console.log(`\nFound ${missingMigrations.length} missing migrations to apply:`);
missingMigrations.forEach(f => console.log(`  - ${f}`));

// Use supabase db push with specific migrations by creating a temp directory
// Actually, better approach: use supabase migration up for individual migrations
// Or use the standard push command which should handle this better

console.log('\nAttempting to push missing migrations...');
const cmd = process.platform === 'win32' ? 'npx' : 'npx';
const args = ['supabase', 'db', 'push', '--yes', '--db-url', dbUrl];

const res = spawnSync(cmd, args, { 
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...env }
});

if (res.error) {
  console.error('Failed to run supabase db push:', res.error);
  process.exit(1);
}

process.exit(res.status || 0);

