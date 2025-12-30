const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
})

async function applyConstraint() {
  console.log('⚠️  Direct SQL execution not available via Supabase JS client.')
  console.log('Please run the following SQL manually in Supabase Studio SQL Editor:\n')
  console.log('=' .repeat(70))
  console.log(`
-- Step 1: Drop the existing check constraint
ALTER TABLE warehouse_pricing
DROP CONSTRAINT IF EXISTS warehouse_pricing_pricing_type_check;

-- Step 2: Add new constraint with all pricing types including pallet-monthly
ALTER TABLE warehouse_pricing
ADD CONSTRAINT warehouse_pricing_pricing_type_check
CHECK (pricing_type IN ('pallet', 'pallet-monthly', 'area', 'area-rental'));

-- Step 3: Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'warehouse_pricing'::regclass
AND conname = 'warehouse_pricing_pricing_type_check';
  `)
  console.log('=' .repeat(70))
  console.log('\nSteps:')
  console.log('1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new')
  console.log('2. Copy the SQL above')
  console.log('3. Paste and click "Run"')
  console.log('4. After success, try setting pallet-monthly pricing again\n')
}

applyConstraint()
