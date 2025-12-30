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

async function fixSchema() {
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
      // Step 1: Drop all constraints on warehouses
      console.log('Step 1: Dropping existing constraints...');
      await client.query(`ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_warehouse_type_check CASCADE;`);
      await client.query(`ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_storage_type_check CASCADE;`);
      await client.query(`ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_temperature_types_check CASCADE;`);
      await client.query(`ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_temperature_type_check CASCADE;`);
      console.log('✅ Constraints dropped');

      // Step 2: Add temp columns
      console.log('Step 2: Adding temporary columns...');
      await client.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_type_single TEXT DEFAULT 'general-dry-ambient';`);
      await client.query(`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS storage_type_single TEXT DEFAULT 'rack-space';`);
      console.log('✅ Temp columns added');

      // Step 3: Migrate data from array to single value
      console.log('Step 3: Migrating data from arrays to single values...');
      await client.query(`
        UPDATE warehouses
        SET warehouse_type_single = COALESCE(warehouse_type[1], 'general-dry-ambient')
        WHERE warehouse_type IS NOT NULL AND array_length(warehouse_type, 1) > 0;
      `);
      await client.query(`
        UPDATE warehouses
        SET storage_type_single = COALESCE(storage_types[1], 'rack-space')
        WHERE storage_types IS NOT NULL AND array_length(storage_types, 1) > 0;
      `);
      console.log('✅ Data migrated');

      // Step 4: Set all warehouse_type to default
      console.log('Step 4: Setting all warehouse_type to general-dry-ambient...');
      await client.query(`UPDATE warehouses SET warehouse_type_single = 'general-dry-ambient';`);
      console.log('✅ warehouse_type set');

      // Step 5: Clean temperature_types (remove invalid values)
      console.log('Step 5: Cleaning temperature_types array...');
      await client.query(`
        UPDATE warehouses
        SET temperature_types = (
          SELECT ARRAY_AGG(value ORDER BY value)
          FROM UNNEST(temperature_types) AS value
          WHERE value IN (
            'ambient-with-ac',
            'ambient-without-ac',
            'ambient-with-heater',
            'ambient-without-heater',
            'chilled',
            'frozen',
            'open-area-with-tent',
            'open-area'
          )
        )
        WHERE temperature_types IS NOT NULL AND array_length(temperature_types, 1) > 0;
      `);
      await client.query(`
        UPDATE warehouses
        SET temperature_types = ARRAY['ambient-with-ac']::text[]
        WHERE temperature_types IS NULL OR temperature_types = '{}'::text[];
      `);
      console.log('✅ temperature_types cleaned');

      // Step 6: Drop old array columns
      console.log('Step 6: Dropping old array columns...');
      await client.query(`ALTER TABLE warehouses DROP COLUMN IF EXISTS warehouse_type CASCADE;`);
      await client.query(`ALTER TABLE warehouses DROP COLUMN IF EXISTS storage_types CASCADE;`);
      console.log('✅ Old columns dropped');

      // Step 7: Rename temp columns
      console.log('Step 7: Renaming temp columns...');
      await client.query(`ALTER TABLE warehouses RENAME COLUMN warehouse_type_single TO warehouse_type;`);
      await client.query(`ALTER TABLE warehouses RENAME COLUMN storage_type_single TO storage_type;`);
      console.log('✅ Columns renamed');

      // Step 8: Set NOT NULL
      console.log('Step 8: Setting NOT NULL constraints...');
      await client.query(`ALTER TABLE warehouses ALTER COLUMN warehouse_type SET NOT NULL;`);
      await client.query(`ALTER TABLE warehouses ALTER COLUMN storage_type SET NOT NULL;`);
      console.log('✅ NOT NULL constraints added');

      // Step 9: Drop at_capacity columns
      console.log('Step 9: Dropping at_capacity columns...');
      await client.query(`ALTER TABLE warehouses DROP COLUMN IF EXISTS at_capacity_sq_ft CASCADE;`);
      await client.query(`ALTER TABLE warehouses DROP COLUMN IF EXISTS at_capacity_pallet CASCADE;`);
      console.log('✅ at_capacity columns dropped');

      // Step 10: Remove appointmentRequired from access_info
      console.log('Step 10: Removing appointmentRequired from access_info...');
      await client.query(`
        UPDATE warehouses
        SET access_info = access_info - 'appointmentRequired'
        WHERE access_info IS NOT NULL AND access_info ? 'appointmentRequired';
      `);
      console.log('✅ access_info cleaned');

      // Step 11: Add check constraints
      console.log('Step 11: Adding check constraints...');
      await client.query(`
        ALTER TABLE warehouses ADD CONSTRAINT warehouses_warehouse_type_check
        CHECK (warehouse_type IN (
          'general-dry-ambient',
          'food-beverage-fda',
          'pharmaceutical-fda-cgmp',
          'medical-devices-fda',
          'nutraceuticals-supplements-fda',
          'cosmetics-fda',
          'hazardous-materials-hazmat',
          'cold-storage',
          'alcohol-tobacco-ttb',
          'consumer-electronics',
          'automotive-parts',
          'ecommerce-high-velocity'
        ));
      `);
      await client.query(`
        ALTER TABLE warehouses ADD CONSTRAINT warehouses_storage_type_check
        CHECK (storage_type IN (
          'bulk-space',
          'rack-space',
          'individual-unit',
          'lockable-unit',
          'cage',
          'open-yard',
          'closed-yard'
        ));
      `);
      await client.query(`
        ALTER TABLE warehouses ADD CONSTRAINT warehouses_temperature_types_check
        CHECK (
          temperature_types <@ ARRAY[
            'ambient-with-ac',
            'ambient-without-ac',
            'ambient-with-heater',
            'ambient-without-heater',
            'chilled',
            'frozen',
            'open-area-with-tent',
            'open-area'
          ]::text[]
        );
      `);
      console.log('✅ Check constraints added');

      console.log('\n✅ Schema migration 087 completed successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixSchema();
