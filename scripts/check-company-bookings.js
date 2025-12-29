require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompanyBookings() {
  // Check for company: 302b77b4-d608-43bf-b0d4-4446047b22f1 (batuhan@outlook.com.tr)
  const companyId = '302b77b4-d608-43bf-b0d4-4446047b22f1';

  console.log('=== Checking Company ===');
  console.log('Company ID:', companyId);

  // Get all warehouses for this company
  console.log('\n=== Warehouses for this company ===');
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, owner_company_id, status')
    .eq('owner_company_id', companyId);

  console.log('Total warehouses:', warehouses?.length || 0);
  console.log(JSON.stringify(warehouses, null, 2));

  if (!warehouses || warehouses.length === 0) {
    console.log('No warehouses found for this company!');
    return;
  }

  const warehouseIds = warehouses.map(w => w.id);
  console.log('\nWarehouse IDs:', warehouseIds);

  // Get all bookings for these warehouses
  console.log('\n=== Bookings for these warehouses ===');
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, warehouse_id, customer_id, customer_name, booking_status, status, total_amount, created_at')
    .in('warehouse_id', warehouseIds)
    .eq('status', true);

  console.log('Total bookings:', bookings?.length || 0);
  console.log(JSON.stringify(bookings, null, 2));

  // Check the user
  console.log('\n=== Users in this company ===');
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, role, company_id')
    .eq('company_id', companyId);

  console.log('Total users:', users?.length || 0);
  console.log(JSON.stringify(users, null, 2));
}

checkCompanyBookings().catch(console.error);
