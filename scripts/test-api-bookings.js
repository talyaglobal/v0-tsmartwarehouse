require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAPICall() {
  // Simulate the API call for user: batuhan@outlook.com.tr
  const userId = '391097f0-cfb5-46ac-9981-08184e6a7315';
  const companyId = '302b77b4-d608-43bf-b0d4-4446047b22f1';

  console.log('=== Simulating API Call ===');
  console.log('User ID:', userId);
  console.log('Company ID:', companyId);
  console.log('Request: GET /api/v1/bookings?warehouseCompanyId=' + companyId);

  // Step 1: Get user's company_id from profiles
  console.log('\n=== Step 1: Get User Profile ===');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, company_id')
    .eq('id', userId)
    .single();

  console.log('Profile:', profile);

  // Step 2: Get warehouses for this company
  console.log('\n=== Step 2: Get Company Warehouses ===');
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, owner_company_id')
    .eq('owner_company_id', companyId);

  console.log('Warehouses count:', warehouses?.length || 0);

  if (!warehouses || warehouses.length === 0) {
    console.log('ERROR: No warehouses found!');
    return;
  }

  const warehouseIds = warehouses.map(w => w.id);
  console.log('Warehouse IDs:', warehouseIds);

  // Step 3: Get bookings for these warehouses
  console.log('\n=== Step 3: Get Bookings for Warehouses ===');
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, customer_id, customer_name, customer_email, warehouse_id, type, booking_status, status, pallet_count, area_sq_ft, floor_number, hall_id, start_date, end_date, total_amount, notes, created_at, updated_at')
    .eq('status', true)
    .in('warehouse_id', warehouseIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('ERROR:', error);
    return;
  }

  console.log('Bookings count:', bookings?.length || 0);
  console.log('\n=== Bookings Details ===');
  bookings?.forEach(b => {
    console.log({
      id: b.id,
      customer: b.customer_name,
      warehouse_id: b.warehouse_id,
      status: b.booking_status,
      amount: b.total_amount,
      created: b.created_at
    });
  });

  console.log('\n=== SUCCESS: API should return', bookings?.length || 0, 'bookings ===');
}

testAPICall().catch(console.error);
