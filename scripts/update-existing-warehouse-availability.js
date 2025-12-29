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

async function updateAvailability() {
  const root = process.cwd();
  const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
  const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
  const env = Object.assign({}, process.env, parseDotEnv(envPath));
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const client = await pool.connect();
    try {
      console.log('Updating warehouse availability for existing warehouses...\n');

      // Update available_pallet_storage where it's NULL
      const palletResult = await client.query(`
        UPDATE warehouses
        SET available_pallet_storage = total_pallet_storage
        WHERE available_pallet_storage IS NULL AND total_pallet_storage IS NOT NULL
      `);
      console.log(`✓ Updated available_pallet_storage for ${palletResult.rowCount} warehouses`);

      // Update available_sq_ft where it's NULL
      const sqftResult = await client.query(`
        UPDATE warehouses
        SET available_sq_ft = total_sq_ft
        WHERE available_sq_ft IS NULL AND total_sq_ft IS NOT NULL
      `);
      console.log(`✓ Updated available_sq_ft for ${sqftResult.rowCount} warehouses`);

      // Show sample data
      console.log('\nSample warehouse capacities after update:');
      const sample = await client.query(`
        SELECT id, name, total_pallet_storage, available_pallet_storage,
               total_sq_ft, available_sq_ft
        FROM warehouses
        WHERE status = true
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
    console.error('✗ Update failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateAvailability();
