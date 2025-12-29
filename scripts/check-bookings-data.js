require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('=== Checking User Profile ===');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, role, company_id')
    .limit(5);
  console.log('Profiles:', JSON.stringify(profiles, null, 2));

  console.log('\n=== Checking Warehouses ===');
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, owner_company_id, status')
    .limit(5);
  console.log('Warehouses:', JSON.stringify(warehouses, null, 2));

  console.log('\n=== Checking Bookings ===');
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, warehouse_id, customer_id, booking_status, status')
    .eq('status', true)
    .limit(5);
  console.log('Bookings:', JSON.stringify(bookings, null, 2));

  console.log('\n=== Checking if any warehouse has owner_company_id set ===');
  const { data: warehousesWithCompany } = await supabase
    .from('warehouses')
    .select('id, name, owner_company_id')
    .not('owner_company_id', 'is', null);
  console.log('Warehouses with company:', JSON.stringify(warehousesWithCompany, null, 2));
}

checkData().catch(console.error);
