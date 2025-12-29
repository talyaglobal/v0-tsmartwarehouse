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

async function checkCapacity() {
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
      console.log('Checking warehouses table capacity columns...\n');

      // Check columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'warehouses'
        AND (column_name LIKE '%pallet%' OR column_name LIKE '%sq%' OR column_name LIKE '%capacity%' OR column_name LIKE '%available%')
        ORDER BY column_name;
      `);

      console.log('Capacity-related Columns:');
      if (columnsResult.rows.length === 0) {
        console.log('No capacity columns found');
      } else {
        columnsResult.rows.forEach(row => {
          console.log(`- ${row.column_name}: ${row.data_type}, nullable: ${row.is_nullable}, default: ${row.column_default}`);
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkCapacity();
