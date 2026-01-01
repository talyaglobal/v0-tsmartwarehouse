const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '104_add_time_slot_fields_to_bookings.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('Applying migration 104_add_time_slot_fields_to_bookings.sql...');
console.log('Migration SQL:');
console.log(migrationSQL.substring(0, 200) + '...\n');

// Use supabase db execute to run the SQL directly
const cmd = process.platform === 'win32' ? 'npx' : 'npx';
const args = ['supabase', 'db', 'execute', '--file', migrationPath];

console.log(`Running: ${cmd} ${args.join(' ')}`);

const res = spawnSync(cmd, args, { 
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

if (res.error) {
  console.error('Failed to run migration:', res.error);
  process.exit(1);
}

if (res.status !== 0) {
  console.error(`Migration failed with exit code ${res.status}`);
  process.exit(res.status);
}

console.log('\n✅ Migration 104 applied successfully!');
process.exit(0);

