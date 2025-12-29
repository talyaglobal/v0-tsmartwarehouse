require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGetUserCompanyId() {
  const userId = '391097f0-cfb5-46ac-9981-08184e6a7315'; // batuhan@outlook.com.tr

  console.log('=== Testing getUserCompanyId ===');
  console.log('User ID:', userId);

  // Simulate what getUserCompanyId does
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  console.log('\nResult:');
  console.log('Profile:', profile);
  console.log('Error:', error);
  console.log('Company ID:', profile?.company_id);

  if (profile?.company_id) {
    console.log('\n✓ SUCCESS: Company ID found:', profile.company_id);
  } else {
    console.log('\n✗ FAIL: No company ID found');
  }
}

testGetUserCompanyId().catch(console.error);
