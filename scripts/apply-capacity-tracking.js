const { Pool } = require('pg');
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

async function applyMigration() {
  const root = process.cwd();
  const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
  const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
  const env = Object.assign({}, process.env, parseDotEnv(envPath));
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found in .env or environment.');
    process.exit(1);
  }

  console.log('Loaded env from:', envPath);
  console.log('Using DATABASE_URL:', dbUrl.replace(/(:).*@(.*)/, ':*****@$2'));

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const migrationFile = path.join(root, 'supabase', 'migrations', '086_add_available_capacity_columns.sql');
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');

    console.log('\nApplying migration: 086_add_available_capacity_columns.sql');

    const client = await pool.connect();
    try {
      await client.query(migrationSql);
      console.log('✓ Migration applied successfully!');

      // Verify the new columns
      console.log('\nVerifying new columns...');
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'warehouses'
        AND column_name IN ('available_pallet_storage', 'available_sq_ft')
      `);

      console.log('New columns:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}, nullable: ${row.is_nullable}`);
      });

      // Check sample data
      console.log('\nSample warehouse capacities:');
      const sample = await client.query(`
        SELECT id, name, total_pallet_storage, available_pallet_storage,
               total_sq_ft, available_sq_ft
        FROM warehouses
        LIMIT 5
      `);

      sample.rows.forEach(row => {
        console.log(`  ${row.name}:`);
        console.log(`    Pallets: ${row.available_pallet_storage}/${row.total_pallet_storage}`);
        console.log(`    Sq Ft: ${row.available_sq_ft}/${row.total_sq_ft}`);
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
