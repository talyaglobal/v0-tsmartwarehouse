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

async function fixRLS() {
  try {
    await client.connect();
    console.log('Connected successfully!\n');

    // Update the function to be SECURITY DEFINER
    console.log('Updating create_notification_event function to SECURITY DEFINER...');
    const functionSQL = `
CREATE OR REPLACE FUNCTION create_notification_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_value TEXT;
  entity_type_value TEXT;
  entity_id_value TEXT; -- Changed from UUID to TEXT to support both UUID and TEXT booking IDs
  payload_data JSONB;
  warehouse_owner_id UUID;
  customer_id_value UUID;
BEGIN
  -- Determine event type and entity type based on table and operation
  IF TG_TABLE_NAME = 'bookings' THEN
    entity_type_value := 'booking';
    entity_id_value := NEW.id::TEXT; -- Explicitly cast to TEXT
    
    -- Get warehouse owner ID from warehouse
    IF NEW.warehouse_id IS NOT NULL THEN
      SELECT owner_company_id INTO warehouse_owner_id
      FROM warehouses
      WHERE id = NEW.warehouse_id;
    END IF;
    
    IF TG_OP = 'INSERT' AND NEW.booking_status = 'pending' THEN
      event_type_value := 'booking.requested';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id::TEXT,
        'customerId', NEW.customer_id,
        'warehouseId', NEW.warehouse_id,
        'warehouseOwnerId', warehouse_owner_id,
        'bookingType', NEW.type,
        'palletCount', NEW.pallet_count,
        'areaSqFt', NEW.area_sq_ft,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.booking_status = 'pending' AND NEW.booking_status = 'confirmed' THEN
      event_type_value := 'booking.approved';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id::TEXT,
        'customerId', NEW.customer_id,
        'warehouseId', NEW.warehouse_id,
        'warehouseOwnerId', warehouse_owner_id,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.booking_status = 'pending' AND NEW.booking_status = 'cancelled' THEN
      event_type_value := 'booking.rejected';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id::TEXT,
        'customerId', NEW.customer_id,
        'warehouseOwnerId', warehouse_owner_id,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'booking_proposals' THEN
    entity_type_value := 'proposal';
    entity_id_value := NEW.id::TEXT;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.proposal.created';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id::TEXT,
        'proposedPrice', NEW.proposed_price,
        'expiresAt', NEW.expires_at,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
      event_type_value := 'booking.proposal.accepted';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id::TEXT,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
      event_type_value := 'booking.proposal.rejected';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id::TEXT,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    entity_type_value := 'invoice';
    entity_id_value := NEW.id::TEXT;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'invoice.generated';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'bookingId', NEW.booking_id::TEXT,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'dueDate', NEW.due_date,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status != 'paid' THEN
      event_type_value := 'invoice.paid';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'bookingId', NEW.booking_id::TEXT,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'paidAt', NEW.paid_date,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'booking_modifications' THEN
    entity_type_value := 'modification';
    entity_id_value := NEW.id::TEXT;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.modified';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'modificationId', NEW.id,
        'bookingId', NEW.booking_id::TEXT,
        'modificationType', NEW.modification_type,
        'oldValue', NEW.old_value,
        'newValue', NEW.new_value,
        'effectiveDate', NEW.effective_date,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'company_invitations' THEN
    entity_type_value := 'invitation';
    entity_id_value := NEW.id::TEXT;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'team.member.invited';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invitationId', NEW.id,
        'companyId', NEW.company_id,
        'invitedEmail', NEW.email,
        'invitedBy', NEW.invited_by,
        'role', NEW.role,
        'expiresAt', NEW.expires_at,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'company_members' THEN
    entity_type_value := 'team_member';
    entity_id_value := NEW.id::TEXT;
    
    IF TG_OP = 'INSERT' AND NEW.status = 'active' AND NEW.joined_at IS NOT NULL THEN
      event_type_value := 'team.member.joined';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'memberId', NEW.id,
        'companyId', NEW.company_id,
        'userId', NEW.user_id,
        'role', NEW.role,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'warehouse_halls' THEN
    entity_type_value := 'warehouse';
    
    -- Get warehouse ID from hall
    SELECT warehouse_id::TEXT INTO entity_id_value
    FROM warehouse_floors
    WHERE id = NEW.floor_id;
    
    IF TG_OP = 'UPDATE' AND (OLD.occupied_sq_ft != NEW.occupied_sq_ft OR OLD.available_sq_ft != NEW.available_sq_ft) THEN
      -- Get warehouse owner
      SELECT owner_company_id INTO warehouse_owner_id
      FROM warehouses
      WHERE id = entity_id_value::UUID;
      
      event_type_value := 'warehouse.occupancy.updated';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'warehouseId', entity_id_value,
        'warehouseOwnerId', warehouse_owner_id,
        'occupancyPercent', CASE 
          WHEN NEW.sq_ft > 0 THEN (NEW.occupied_sq_ft::DECIMAL / NEW.sq_ft::DECIMAL * 100)
          ELSE 0
        END,
        'availableSqFt', NEW.available_sq_ft,
        'occupiedSqFt', NEW.occupied_sq_ft,
        'updatedBy', COALESCE(current_setting('app.user_id', true), 'system'),
        'timestamp', NOW()
      );
    END IF;
  END IF;
  
  -- Insert notification event if we have valid data
  IF event_type_value IS NOT NULL AND payload_data IS NOT NULL THEN
    INSERT INTO notification_events (
      event_type,
      entity_type,
      entity_id,
      payload,
      status
    ) VALUES (
      event_type_value,
      entity_type_value,
      entity_id_value,
      payload_data,
      'pending'::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    await client.query(functionSQL);
    console.log('✅ Function updated to SECURITY DEFINER');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    await client.end();
    process.exit(1);
  }
}

fixRLS();

