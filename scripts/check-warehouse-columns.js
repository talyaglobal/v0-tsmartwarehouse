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

async function checkData() {
  const root = process.cwd();
  const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
  const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
  const env = Object.assign({}, process.env, parseDotEnv(envPath));
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found in .env or environment.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const client = await pool.connect();
    try {
      // Check what columns exist
      const columnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'warehouses'
        ORDER BY column_name;
      `);
      console.log('Current warehouses columns:');
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });

      // Check temperature_types values
      const tempTypesResult = await client.query(`
        SELECT id, temperature_types, warehouse_type, storage_types
        FROM warehouses
        LIMIT 5;
      `);
      console.log('\nSample warehouses data:');
      tempTypesResult.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });

      // Check for invalid temperature_types values
      const invalidResult = await client.query(`
        SELECT id, temperature_types
        FROM warehouses
        WHERE temperature_types IS NOT NULL
        AND temperature_types != '{}';
      `);
      console.log(`\nTotal warehouses with temperature_types: ${invalidResult.rows.length}`);
      console.log('Unique temperature_types values:');
      const uniqueValues = new Set();
      invalidResult.rows.forEach(row => {
        if (Array.isArray(row.temperature_types)) {
          row.temperature_types.forEach(val => uniqueValues.add(val));
        }
      });
      uniqueValues.forEach(val => console.log(`  - ${val}`));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkData();
