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

async function checkConstraints() {
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
      console.log('Checking bookings table constraints...\n');

      // Check columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'bookings'
        AND column_name IN ('status', 'booking_status')
        ORDER BY column_name;
      `);

      console.log('Columns:');
      columnsResult.rows.forEach(row => {
        console.log(`- ${row.column_name}: ${row.data_type}, nullable: ${row.is_nullable}, default: ${row.column_default}`);
      });

      // Check constraints
      const constraintsResult = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%bookings%status%'
        ORDER BY constraint_name;
      `);

      console.log('\nCheck Constraints:');
      if (constraintsResult.rows.length === 0) {
        console.log('No check constraints found');
      } else {
        constraintsResult.rows.forEach(row => {
          console.log(`- ${row.constraint_name}: ${row.check_clause}`);
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

checkConstraints();
