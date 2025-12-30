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
      // Check sample data
      const result = await client.query(`
        SELECT id, name, warehouse_type, storage_type, temperature_types
        FROM warehouses
        LIMIT 5;
      `);
      console.log('✅ Sample warehouses data after migration:');
      result.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });

      // Check column data types
      const typeResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'warehouses'
        AND column_name IN ('warehouse_type', 'storage_type', 'temperature_types');
      `);
      console.log('\n✅ Column data types:');
      typeResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });

      // Verify all warehouse_type values are 'general-dry-ambient'
      const typeCheckResult = await client.query(`
        SELECT DISTINCT warehouse_type FROM warehouses;
      `);
      console.log('\n✅ Unique warehouse_type values:');
      typeCheckResult.rows.forEach(row => {
        console.log(`  - ${row.warehouse_type}`);
      });

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
