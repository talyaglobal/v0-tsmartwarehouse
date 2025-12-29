require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGetBookingsLogic() {
  const companyId = '302b77b4-d608-43bf-b0d4-4446047b22f1';
  const userId = '391097f0-cfb5-46ac-9981-08184e6a7315';

  console.log('=== Testing getBookings Logic ===');
  console.log('User ID:', userId);
  console.log('Company ID:', companyId);

  // Step 1: Verify user's company_id
  console.log('\n=== Step 1: Get user company_id ===');
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, company_id')
    .eq('id', userId)
    .single();

  console.log('User profile:', userProfile);
  if (profileError) {
    console.error('Error:', profileError);
    return;
  }

  const userCompanyId = userProfile?.company_id;
  console.log('User company_id:', userCompanyId);

  // Step 2: Check if user is admin
  console.log('\n=== Step 2: Check if user is admin ===');
  const { data: adminCheck } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .in('role', ['company_owner', 'company_admin'])
    .eq('company_id', companyId)
    .maybeSingle();

  console.log('Is admin:', !!adminCheck);
  console.log('Admin check data:', adminCheck);

  // Step 3: Get warehouses for company
  console.log('\n=== Step 3: Get warehouses ===');
  const { data: warehouses, error: warehousesError } = await supabase
    .from('warehouses')
    .select('id, name, owner_company_id')
    .eq('owner_company_id', companyId);

  if (warehousesError) {
    console.error('Warehouses error:', warehousesError);
    return;
  }

  console.log('Warehouses count:', warehouses?.length || 0);
  const warehouseIds = (warehouses || []).map(w => w.id);
  console.log('Warehouse IDs:', warehouseIds);

  // Step 4: Get bookings
  console.log('\n=== Step 4: Get bookings ===');
  if (warehouseIds.length === 0) {
    console.log('No warehouses, would return empty array');
    return;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, customer_id, customer_name, warehouse_id, type, booking_status, status, total_amount, created_at')
    .eq('status', true)
    .in('warehouse_id', warehouseIds)
    .order('created_at', { ascending: false });

  if (bookingsError) {
    console.error('Bookings error:', bookingsError);
    return;
  }

  console.log('Bookings count:', bookings?.length || 0);

  if (bookings && bookings.length > 0) {
    console.log('\n=== Sample Bookings ===');
    bookings.slice(0, 3).forEach(b => {
      console.log({
        id: b.id,
        customer: b.customer_name,
        warehouse_id: b.warehouse_id,
        status: b.booking_status,
        amount: b.total_amount
      });
    });
  }

  console.log('\n=== RESULT ===');
  console.log('Should return:', bookings?.length || 0, 'bookings');
}

testGetBookingsLogic().catch(console.error);
