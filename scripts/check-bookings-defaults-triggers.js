const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  return env;
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

const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDefaultsAndTriggers() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Check default value for bookings.id
    const defaultCheck = await client.query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'id';
    `);
    
    if (defaultCheck.rows.length > 0) {
      console.log('bookings.id default value:', defaultCheck.rows[0].column_default || 'NULL');
      if (defaultCheck.rows[0].column_default && defaultCheck.rows[0].column_default.includes('uuid')) {
        console.log('⚠️  WARNING: bookings.id has a UUID default value!');
      }
    }

    // Check triggers on bookings table
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'bookings';
    `);
    
    console.log('\nTriggers on bookings table:');
    if (triggerCheck.rows.length > 0) {
      triggerCheck.rows.forEach(row => {
        console.log(`  ${row.trigger_name}: ${row.event_manipulation}`);
        if (row.action_statement && row.action_statement.includes('uuid')) {
          console.log('    ⚠️  WARNING: Trigger contains UUID reference!');
        }
      });
    } else {
      console.log('  No triggers found');
    }

    // Check foreign key constraints that reference bookings.id
    const fkCheck = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'bookings'
        AND ccu.column_name = 'id';
    `);

    console.log('\nForeign key constraints referencing bookings.id:');
    if (fkCheck.rows.length > 0) {
      fkCheck.rows.forEach(row => {
        console.log(`  ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        // Check if the column is still UUID
        client.query(`
          SELECT data_type, udt_name
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2;
        `, [row.table_name, row.column_name]).then(result => {
          if (result.rows.length > 0) {
            const colType = result.rows[0];
            if (colType.data_type === 'uuid' || colType.udt_name === 'uuid') {
              console.log(`    ⚠️  WARNING: ${row.table_name}.${row.column_name} is still UUID!`);
            }
          }
        }).catch(() => {});
      });
    } else {
      console.log('  No foreign key constraints found');
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkDefaultsAndTriggers();

