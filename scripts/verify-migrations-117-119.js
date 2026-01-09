/**
 * Verify Migrations 117, 118, 119 are Applied
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    return { exists: false, error: error.message };
  }
  return { exists: true };
}

async function verifyColumn(tableName, columnName) {
  // Try to query the column
  const { error } = await supabase
    .from(tableName)
    .select(columnName)
    .limit(1);

  if (error) {
    return { exists: false, error: error.message };
  }
  return { exists: true };
}

async function main() {
  console.log('🔍 Verifying Migrations 117, 118, 119...\n');

  // Verify Migration 117: Extended CRM contacts
  console.log('Checking Migration 117 (Extended CRM Contacts)...');
  const contactsColumns = await verifyColumn('crm_contacts', 'first_name');
  if (contactsColumns.exists) {
    console.log('✅ crm_contacts.first_name column exists');
  } else {
    console.log('❌ crm_contacts.first_name column missing');
  }

  // Verify Migration 118: Signature requests table
  console.log('\nChecking Migration 118 (Signature Requests)...');
  const signatureTable = await verifyTable('signature_requests');
  if (signatureTable.exists) {
    console.log('✅ signature_requests table exists');
  } else {
    console.log('❌ signature_requests table missing:', signatureTable.error);
  }

  // Verify Migration 119: Agreement tracking tables
  console.log('\nChecking Migration 119 (Agreement Tracking)...');
  
  const agreementVersions = await verifyTable('agreement_versions');
  if (agreementVersions.exists) {
    console.log('✅ agreement_versions table exists');
  } else {
    console.log('❌ agreement_versions table missing:', agreementVersions.error);
  }

  const userAgreements = await verifyTable('user_agreements');
  if (userAgreements.exists) {
    console.log('✅ user_agreements table exists');
  } else {
    console.log('❌ user_agreements table missing:', userAgreements.error);
  }

  const warehouseAgreements = await verifyTable('warehouse_agreements');
  if (warehouseAgreements.exists) {
    console.log('✅ warehouse_agreements table exists');
  } else {
    console.log('❌ warehouse_agreements table missing:', warehouseAgreements.error);
  }

  const bookingAgreements = await verifyTable('booking_agreements');
  if (bookingAgreements.exists) {
    console.log('✅ booking_agreements table exists');
  } else {
    console.log('❌ booking_agreements table missing:', bookingAgreements.error);
  }

  // Check JSONB columns
  console.log('\nChecking JSONB columns...');
  const profilesAgreements = await verifyColumn('profiles', 'agreements_accepted');
  if (profilesAgreements.exists) {
    console.log('✅ profiles.agreements_accepted column exists');
  } else {
    console.log('❌ profiles.agreements_accepted column missing');
  }

  const warehousesAgreements = await verifyColumn('warehouses', 'owner_agreements');
  if (warehousesAgreements.exists) {
    console.log('✅ warehouses.owner_agreements column exists');
  } else {
    console.log('❌ warehouses.owner_agreements column missing');
  }

  const bookingsAgreements = await verifyColumn('bookings', 'booking_agreements');
  if (bookingsAgreements.exists) {
    console.log('✅ bookings.booking_agreements column exists');
  } else {
    console.log('❌ bookings.booking_agreements column missing');
  }

  console.log('\n✅ Verification complete!');
}

main().catch(console.error);

