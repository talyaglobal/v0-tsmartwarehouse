# Warehouse Finder & Reseller Role Implementation

**Last Updated**: January 9, 2026  
**Status**: Planning Phase  
**Priority**: High

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Role Definitions](#role-definitions)
3. [Database Schema](#database-schema)
4. [CRM Pipeline System](#crm-pipeline-system)
5. [Dashboard Requirements](#dashboard-requirements)
6. [Implementation Steps](#implementation-steps)
7. [API Endpoints](#api-endpoints)
8. [UI Components](#ui-components)

---

## 🎯 Overview

This document outlines the implementation of two new business development roles:
- **Warehouse Finder**: Scouts and onboards warehouse suppliers to the platform
- **Reseller**: Identifies and converts potential customers to use the platform

Both roles include:
- Dedicated CRM dashboards
- Pipeline management (10 milestones, 10% each)
- Activity tracking (visits, calls, emails)
- Admin approval workflows
- Location-based warehouse discovery
- Performance metrics and analytics

---

## 👥 Role Definitions

### 1. Warehouse Finder (warehouse_finder)
**Purpose**: Business development role focused on supplier acquisition

**Responsibilities**:
- Find potential warehouse suppliers
- Create and manage CRM contacts for warehouse owners
- Use system to discover warehouses by location
- Schedule and conduct warehouse visits
- Document visit notes and property details
- Track conversion pipeline from contact → first reservation
- Request admin approval for promising leads
- Maintain relationship with onboarded warehouses

**Success Metric**: First reservation made from discovered warehouse (100% milestone)

---

### 2. Reseller (reseller)
**Purpose**: Business development role focused on customer acquisition

**Responsibilities**:
- Identify potential customers (companies needing warehouse space)
- Create and manage CRM contacts for potential clients
- Multi-channel outreach (calls, emails, visits)
- Track all communication activities through system
- Manage conversion pipeline from contact → first purchase
- Request admin approval for high-value leads
- Monitor customer engagement and conversion rates

**Success Metric**: First purchase/booking made by acquired customer (100% milestone)

---

## 🗄️ Database Schema

### Migration: Add New Roles to Profiles

```sql
-- Migration: Add Warehouse Finder and Reseller Roles
-- File: supabase/migrations/112_add_warehouse_finder_reseller_roles.sql

-- Step 1: Drop existing role constraint
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

-- Step 2: Add new constraint with warehouse_finder and reseller roles
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'root', 
  'warehouse_owner', 
  'warehouse_admin', 
  'customer', 
  'warehouse_staff',
  'warehouse_finder',
  'reseller'
));

-- Step 3: Update role column comment
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), warehouse_owner (Warehouse Owner), warehouse_admin (Warehouse Admin), customer (Customer/Member), warehouse_staff (Warehouse Staff), warehouse_finder (Warehouse Scout/BD), reseller (Customer Acquisition/BD)';

-- Step 4: Create indexes for new roles
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_finder ON profiles(role) WHERE role = 'warehouse_finder';
CREATE INDEX IF NOT EXISTS idx_profiles_reseller ON profiles(role) WHERE role = 'reseller';
```

---

### CRM Contacts Table

```sql
-- CRM Contacts for both Warehouse Finders and Resellers
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Contact Type
  contact_type TEXT NOT NULL CHECK (contact_type IN ('warehouse_supplier', 'customer_lead')),
  
  -- Basic Information
  contact_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  
  -- Location (for warehouse suppliers)
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Turkey',
  postal_code TEXT,
  location GEOGRAPHY(POINT, 4326), -- PostGIS for location-based search
  
  -- Warehouse Details (for warehouse_supplier type)
  warehouse_size_sqm DECIMAL(10, 2),
  warehouse_type TEXT[], -- ['cold_storage', 'dry_storage', 'hazmat', etc.]
  available_services TEXT[], -- ['loading', 'packaging', 'inventory_management', etc.]
  estimated_capacity INTEGER,
  current_utilization_percent INTEGER,
  
  -- Customer Details (for customer_lead type)
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  estimated_space_need_sqm DECIMAL(10, 2),
  budget_range TEXT,
  decision_maker_name TEXT,
  decision_maker_title TEXT,
  
  -- Pipeline Stage (0-100%)
  pipeline_stage INTEGER NOT NULL DEFAULT 10 CHECK (pipeline_stage >= 0 AND pipeline_stage <= 100),
  pipeline_milestone TEXT NOT NULL DEFAULT 'contact_created',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'approved', 'rejected', 'converted', 'inactive', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Admin Approval
  requires_approval BOOLEAN DEFAULT false,
  approval_requested_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Conversion Tracking
  converted_to_warehouse_id UUID REFERENCES warehouses(id),
  converted_to_customer_id UUID REFERENCES profiles(id),
  first_transaction_date TIMESTAMPTZ,
  first_transaction_amount DECIMAL(10, 2),
  
  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contact_date TIMESTAMPTZ,
  next_follow_up_date TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_crm_contacts_created_by ON crm_contacts(created_by);
CREATE INDEX idx_crm_contacts_assigned_to ON crm_contacts(assigned_to);
CREATE INDEX idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX idx_crm_contacts_contact_type ON crm_contacts(contact_type);
CREATE INDEX idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX idx_crm_contacts_pipeline_stage ON crm_contacts(pipeline_stage);
CREATE INDEX idx_crm_contacts_location ON crm_contacts USING GIST(location);
CREATE INDEX idx_crm_contacts_next_follow_up ON crm_contacts(next_follow_up_date) WHERE status = 'active';

-- Enable RLS
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
```

---

### CRM Activities Table

```sql
-- Track all activities (visits, calls, emails, meetings)
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Activity Details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'visit', 'call', 'email', 'meeting', 'note', 'task', 'proposal_sent', 'contract_sent', 'follow_up'
  )),
  
  -- Content
  subject TEXT NOT NULL,
  description TEXT,
  outcome TEXT, -- 'successful', 'needs_follow_up', 'not_interested', 'callback_requested'
  
  -- Visit Specific (for warehouse_finder)
  visit_date TIMESTAMPTZ,
  visit_location TEXT,
  visit_duration_minutes INTEGER,
  visit_notes TEXT,
  visit_photos TEXT[], -- URLs to uploaded photos
  property_condition TEXT, -- 'excellent', 'good', 'fair', 'poor'
  owner_interest_level TEXT, -- 'very_interested', 'interested', 'neutral', 'not_interested'
  
  -- Call/Email Specific
  call_duration_minutes INTEGER,
  call_recording_url TEXT,
  email_sent_at TIMESTAMPTZ,
  email_opened BOOLEAN DEFAULT false,
  email_clicked BOOLEAN DEFAULT false,
  
  -- Task Management
  is_task BOOLEAN DEFAULT false,
  task_due_date TIMESTAMPTZ,
  task_completed BOOLEAN DEFAULT false,
  task_completed_at TIMESTAMPTZ,
  
  -- Pipeline Impact
  moved_to_stage INTEGER, -- New pipeline stage after this activity
  stage_change_reason TEXT,
  
  -- Metadata
  attachments JSONB DEFAULT '[]',
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_created_by ON crm_activities(created_by);
CREATE INDEX idx_crm_activities_activity_type ON crm_activities(activity_type);
CREATE INDEX idx_crm_activities_visit_date ON crm_activities(visit_date) WHERE activity_type = 'visit';
CREATE INDEX idx_crm_activities_tasks ON crm_activities(task_due_date) WHERE is_task = true AND task_completed = false;

-- Enable RLS
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
```

---

### Pipeline Milestones Table

```sql
-- Define pipeline stages for both warehouse_finder and reseller
CREATE TABLE IF NOT EXISTS crm_pipeline_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pipeline Configuration
  pipeline_type TEXT NOT NULL CHECK (pipeline_type IN ('warehouse_supplier', 'customer_lead')),
  
  -- Milestone Details
  stage_number INTEGER NOT NULL CHECK (stage_number >= 1 AND stage_number <= 10),
  stage_percentage INTEGER NOT NULL CHECK (stage_percentage >= 10 AND stage_percentage <= 100),
  milestone_name TEXT NOT NULL,
  milestone_description TEXT,
  
  -- Requirements
  required_activities TEXT[], -- Activities needed to reach this stage
  typical_duration_days INTEGER, -- Average time to complete this stage
  
  -- Automation
  auto_advance_conditions JSONB, -- Conditions to automatically advance
  notification_template TEXT, -- Notification to send when reached
  
  -- Display
  icon TEXT,
  color TEXT,
  display_order INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(pipeline_type, stage_number)
);

-- Insert default milestones for Warehouse Finder
INSERT INTO crm_pipeline_milestones (pipeline_type, stage_number, stage_percentage, milestone_name, milestone_description, required_activities) VALUES
-- Warehouse Supplier Pipeline
('warehouse_supplier', 1, 10, 'Contact Created', 'Initial warehouse contact added to CRM', ARRAY['note']),
('warehouse_supplier', 2, 20, 'First Contact Made', 'Initial call or email sent to warehouse owner', ARRAY['call', 'email']),
('warehouse_supplier', 3, 30, 'Interest Confirmed', 'Warehouse owner shows interest in joining platform', ARRAY['call', 'meeting']),
('warehouse_supplier', 4, 40, 'Site Visit Scheduled', 'Physical warehouse visit appointment scheduled', ARRAY['meeting']),
('warehouse_supplier', 5, 50, 'Site Visit Completed', 'Warehouse inspection and documentation completed', ARRAY['visit']),
('warehouse_supplier', 6, 60, 'Admin Approval Requested', 'Submitted warehouse details for admin review', ARRAY['note']),
('warehouse_supplier', 7, 70, 'Admin Approved', 'Admin approved warehouse for onboarding', ARRAY['note']),
('warehouse_supplier', 8, 80, 'Contract Negotiation', 'Terms and pricing being negotiated', ARRAY['meeting', 'proposal_sent']),
('warehouse_supplier', 9, 90, 'Contract Signed', 'Warehouse owner signed partnership agreement', ARRAY['contract_sent']),
('warehouse_supplier', 10, 100, 'First Reservation', 'First customer booking received for this warehouse', ARRAY['note']),

-- Customer Lead Pipeline
('customer_lead', 1, 10, 'Lead Created', 'Potential customer added to CRM', ARRAY['note']),
('customer_lead', 2, 20, 'First Outreach', 'Initial contact attempt made', ARRAY['call', 'email']),
('customer_lead', 3, 30, 'Contact Established', 'Customer responded and showed interest', ARRAY['call', 'email']),
('customer_lead', 4, 40, 'Needs Assessment', 'Understanding customer requirements', ARRAY['meeting', 'call']),
('customer_lead', 5, 50, 'Demo/Presentation', 'Platform demo or presentation completed', ARRAY['meeting']),
('customer_lead', 6, 60, 'Proposal Sent', 'Custom proposal or quote sent to customer', ARRAY['proposal_sent']),
('customer_lead', 7, 70, 'Negotiation', 'Discussing terms, pricing, and requirements', ARRAY['meeting', 'call']),
('customer_lead', 8, 80, 'Decision Stage', 'Customer evaluating final decision', ARRAY['follow_up']),
('customer_lead', 9, 90, 'Commitment', 'Customer committed to using platform', ARRAY['contract_sent']),
('customer_lead', 10, 100, 'First Purchase', 'Customer made first warehouse booking/purchase', ARRAY['note']);

-- Indexes
CREATE INDEX idx_pipeline_milestones_type ON crm_pipeline_milestones(pipeline_type);
CREATE INDEX idx_pipeline_milestones_stage ON crm_pipeline_milestones(stage_number);
```

---

### CRM Performance Metrics Table

```sql
-- Track performance metrics for warehouse_finder and reseller roles
CREATE TABLE IF NOT EXISTS crm_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Time Period
  metric_date DATE NOT NULL,
  metric_month DATE NOT NULL, -- First day of month
  metric_quarter TEXT NOT NULL, -- 'Q1-2026'
  metric_year INTEGER NOT NULL,
  
  -- Activity Metrics
  contacts_created INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  visits_conducted INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  
  -- Pipeline Metrics
  contacts_in_pipeline INTEGER DEFAULT 0,
  contacts_moved_forward INTEGER DEFAULT 0,
  contacts_moved_backward INTEGER DEFAULT 0,
  contacts_converted INTEGER DEFAULT 0,
  average_pipeline_stage DECIMAL(5, 2),
  
  -- Conversion Metrics
  conversion_rate DECIMAL(5, 2), -- Percentage
  average_days_to_convert DECIMAL(10, 2),
  total_revenue_generated DECIMAL(12, 2),
  
  -- Quality Metrics
  admin_approvals_requested INTEGER DEFAULT 0,
  admin_approvals_granted INTEGER DEFAULT 0,
  admin_approval_rate DECIMAL(5, 2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, metric_date)
);

-- Indexes
CREATE INDEX idx_crm_metrics_user_id ON crm_performance_metrics(user_id);
CREATE INDEX idx_crm_metrics_date ON crm_performance_metrics(metric_date);
CREATE INDEX idx_crm_metrics_month ON crm_performance_metrics(metric_month);

-- Enable RLS
ALTER TABLE crm_performance_metrics ENABLE ROW LEVEL SECURITY;
```

---

## 📊 CRM Pipeline System

### Pipeline Stages (10 Milestones)

#### Warehouse Finder Pipeline (Warehouse Supplier)

| Stage | % | Milestone | Key Activities | Success Criteria |
|-------|---|-----------|----------------|------------------|
| 1 | 10% | Contact Created | Add warehouse to CRM, gather basic info | Contact record created |
| 2 | 20% | First Contact Made | Initial outreach (call/email) | Response received |
| 3 | 30% | Interest Confirmed | Owner shows interest | Verbal commitment to learn more |
| 4 | 40% | Site Visit Scheduled | Book warehouse inspection | Appointment confirmed |
| 5 | 50% | Site Visit Completed | Document property, take photos | Visit notes and photos uploaded |
| 6 | 60% | Admin Approval Requested | Submit for review | Admin notified |
| 7 | 70% | Admin Approved | Green light from admin | Approval granted |
| 8 | 80% | Contract Negotiation | Discuss terms | Draft agreement prepared |
| 9 | 90% | Contract Signed | Partnership finalized | Signed contract received |
| 10 | 100% | First Reservation | Customer books warehouse | First booking completed |

---

#### Reseller Pipeline (Customer Lead)

| Stage | % | Milestone | Key Activities | Success Criteria |
|-------|---|-----------|----------------|------------------|
| 1 | 10% | Lead Created | Add potential customer to CRM | Lead record created |
| 2 | 20% | First Outreach | Initial contact attempt | Outreach documented |
| 3 | 30% | Contact Established | Customer responds | Two-way communication |
| 4 | 40% | Needs Assessment | Understand requirements | Needs documented |
| 5 | 50% | Demo/Presentation | Show platform capabilities | Demo completed |
| 6 | 60% | Proposal Sent | Custom quote provided | Proposal delivered |
| 7 | 70% | Negotiation | Discuss terms | Active negotiation |
| 8 | 80% | Decision Stage | Customer evaluating | Decision timeline set |
| 9 | 90% | Commitment | Customer commits | Verbal agreement |
| 10 | 100% | First Purchase | Customer makes booking | First transaction completed |

---

### Automated Pipeline Advancement

```typescript
// lib/business-logic/crm-pipeline-automation.ts

interface PipelineAdvancementRule {
  fromStage: number;
  toStage: number;
  conditions: {
    requiredActivities?: string[];
    minimumDaysSinceLastStage?: number;
    adminApprovalRequired?: boolean;
  };
}

// Auto-advance rules
const warehouseFinderRules: PipelineAdvancementRule[] = [
  {
    fromStage: 10,
    toStage: 20,
    conditions: {
      requiredActivities: ['call', 'email'],
    },
  },
  {
    fromStage: 40,
    toStage: 50,
    conditions: {
      requiredActivities: ['visit'],
    },
  },
  // ... more rules
];
```

---

## 🎨 Dashboard Requirements

### 1. Warehouse Finder Dashboard

**Route**: `/dashboard/warehouse-finder`

#### Key Sections:

##### A. Overview Cards (Top Row)
- Total Contacts Created
- Active Pipeline Contacts
- Visits This Month
- Conversion Rate
- Avg. Pipeline Stage
- Pending Admin Approvals

##### B. Map View (Location-Based Discovery)
- Interactive map showing:
  - Existing warehouses in system (green pins)
  - CRM contacts/prospects (yellow pins)
  - User's current location (blue pin)
- Filter by:
  - Distance radius (5km, 10km, 25km, 50km)
  - Warehouse type
  - Pipeline stage
- Click pin to view details or add to CRM

##### C. Pipeline Kanban Board
- 10 columns (10% to 100%)
- Drag-and-drop contacts between stages
- Color-coded by priority
- Quick actions: Call, Email, Schedule Visit, Request Approval

##### D. Contact List View
- Sortable/filterable table
- Columns: Name, Company, Location, Stage, Last Contact, Next Follow-up
- Quick filters: My Contacts, Needs Follow-up, Pending Approval, High Priority

##### E. Activity Feed
- Recent activities across all contacts
- Filter by type: Visits, Calls, Emails, Notes
- Timeline view with date grouping

##### F. Visit Planner
- Calendar view of scheduled visits
- Route optimization for multiple visits
- Visit checklist template
- Photo upload for property documentation

##### G. Performance Dashboard
- Conversion funnel visualization
- Activity metrics (calls, emails, visits per week/month)
- Average time per pipeline stage
- Revenue generated from converted warehouses

---

### 2. Reseller Dashboard

**Route**: `/dashboard/reseller`

#### Key Sections:

##### A. Overview Cards (Top Row)
- Total Leads Created
- Active Opportunities
- Outreach This Month
- Conversion Rate
- Avg. Deal Size
- Pipeline Value

##### B. Pipeline Kanban Board
- 10 columns (10% to 100%)
- Drag-and-drop leads between stages
- Deal value displayed on cards
- Quick actions: Call, Email, Send Proposal, Schedule Meeting

##### C. Lead List View
- Sortable/filterable table
- Columns: Company, Contact, Industry, Stage, Deal Value, Last Activity
- Quick filters: Hot Leads, Follow-up Today, Proposal Sent, High Value

##### D. Multi-Channel Communication Hub
- **Email Integration**:
  - Send emails through system
  - Track opens and clicks
  - Email templates for each pipeline stage
  
- **Call Logging**:
  - Log call details
  - Record call duration and outcome
  - Set follow-up reminders
  
- **Meeting Scheduler**:
  - Calendar integration
  - Send meeting invites
  - Automatic reminders

##### E. Activity Timeline
- Unified view of all interactions
- Filter by: Calls, Emails, Meetings, Notes
- Color-coded by activity type
- Shows email open/click status

##### F. Proposal & Document Management
- Template library for proposals
- Track document status (sent, viewed, signed)
- Version control
- E-signature integration

##### G. Performance Dashboard
- Conversion funnel visualization
- Activity metrics (calls, emails, meetings per week/month)
- Win/loss analysis
- Revenue forecasting

---

## 🔧 Implementation Steps

### Phase 1: Database Setup (Week 1)

1. **Create Migration Files**:
   ```bash
   # Create new migration
   supabase migration new add_warehouse_finder_reseller_roles
   ```

2. **Tables to Create**:
   - ✅ Update `profiles` table with new roles
   - ✅ Create `crm_contacts` table
   - ✅ Create `crm_activities` table
   - ✅ Create `crm_pipeline_milestones` table
   - ✅ Create `crm_performance_metrics` table

3. **RLS Policies**:
   - Warehouse finders can only see their own contacts
   - Resellers can only see their own leads
   - Admins can see all CRM data
   - Company admins can see their company's CRM data

4. **Functions & Triggers**:
   - Auto-update `last_contact_date` on activity creation
   - Auto-calculate pipeline metrics
   - Trigger notifications on stage changes
   - Auto-advance pipeline based on rules

---

### Phase 2: Backend API (Week 2)

#### API Endpoints to Create:

**CRM Contacts**:
```typescript
// app/api/crm/contacts/route.ts
POST   /api/crm/contacts              // Create new contact
GET    /api/crm/contacts              // List contacts (with filters)
GET    /api/crm/contacts/:id          // Get contact details
PATCH  /api/crm/contacts/:id          // Update contact
DELETE /api/crm/contacts/:id          // Archive contact
POST   /api/crm/contacts/:id/approve  // Request admin approval
```

**CRM Activities**:
```typescript
// app/api/crm/activities/route.ts
POST   /api/crm/activities            // Log new activity
GET    /api/crm/activities            // List activities
GET    /api/crm/activities/:id        // Get activity details
PATCH  /api/crm/activities/:id        // Update activity
DELETE /api/crm/activities/:id        // Delete activity
```

**Pipeline Management**:
```typescript
// app/api/crm/pipeline/route.ts
GET    /api/crm/pipeline              // Get pipeline overview
PATCH  /api/crm/pipeline/:contactId   // Move contact to stage
GET    /api/crm/pipeline/milestones   // Get milestone definitions
```

**Location-Based Discovery**:
```typescript
// app/api/crm/discover/route.ts
POST   /api/crm/discover/warehouses   // Find warehouses near location
GET    /api/crm/discover/nearby       // Get nearby contacts
```

**Performance Metrics**:
```typescript
// app/api/crm/metrics/route.ts
GET    /api/crm/metrics/personal      // Get user's metrics
GET    /api/crm/metrics/team          // Get team metrics (admin)
```

---

### Phase 3: Frontend Components (Week 3-4)

#### Shared Components:

1. **CRM Contact Card** (`components/crm/ContactCard.tsx`)
2. **Pipeline Stage Column** (`components/crm/PipelineColumn.tsx`)
3. **Activity Timeline** (`components/crm/ActivityTimeline.tsx`)
4. **Activity Logger Modal** (`components/crm/ActivityLoggerModal.tsx`)
5. **Contact Form** (`components/crm/ContactForm.tsx`)
6. **Pipeline Progress Bar** (`components/crm/PipelineProgressBar.tsx`)
7. **Metrics Dashboard** (`components/crm/MetricsDashboard.tsx`)

#### Warehouse Finder Specific:

1. **Warehouse Discovery Map** (`components/crm/warehouse-finder/DiscoveryMap.tsx`)
2. **Visit Planner** (`components/crm/warehouse-finder/VisitPlanner.tsx`)
3. **Visit Logger** (`components/crm/warehouse-finder/VisitLogger.tsx`)
4. **Property Documentation** (`components/crm/warehouse-finder/PropertyDocs.tsx`)

#### Reseller Specific:

1. **Email Composer** (`components/crm/reseller/EmailComposer.tsx`)
2. **Call Logger** (`components/crm/reseller/CallLogger.tsx`)
3. **Proposal Builder** (`components/crm/reseller/ProposalBuilder.tsx`)
4. **Meeting Scheduler** (`components/crm/reseller/MeetingScheduler.tsx`)

---

### Phase 4: Dashboard Pages (Week 5)

#### Create Dashboard Routes:

```typescript
// app/(dashboard)/warehouse-finder/page.tsx
// Main dashboard for warehouse finders

// app/(dashboard)/warehouse-finder/contacts/page.tsx
// Contact list view

// app/(dashboard)/warehouse-finder/contacts/[id]/page.tsx
// Individual contact detail page

// app/(dashboard)/warehouse-finder/map/page.tsx
// Full-screen map view for discovery

// app/(dashboard)/warehouse-finder/visits/page.tsx
// Visit planner and history

// app/(dashboard)/warehouse-finder/performance/page.tsx
// Performance metrics and analytics
```

```typescript
// app/(dashboard)/reseller/page.tsx
// Main dashboard for resellers

// app/(dashboard)/reseller/leads/page.tsx
// Lead list view

// app/(dashboard)/reseller/leads/[id]/page.tsx
// Individual lead detail page

// app/(dashboard)/reseller/communications/page.tsx
// Multi-channel communication hub

// app/(dashboard)/reseller/proposals/page.tsx
// Proposal management

// app/(dashboard)/reseller/performance/page.tsx
// Performance metrics and analytics
```

---

### Phase 5: Admin Controls (Week 6)

#### Admin Dashboard Sections:

1. **CRM Overview** (`app/(admin)/admin/crm/page.tsx`)
   - All contacts across both pipelines
   - Team performance metrics
   - Approval queue

2. **Approval Management** (`app/(admin)/admin/crm/approvals/page.tsx`)
   - Pending warehouse approvals
   - Pending lead approvals
   - Approval history

3. **Team Management** (`app/(admin)/admin/crm/team/page.tsx`)
   - Assign contacts to team members
   - Set quotas and targets
   - Performance leaderboard

4. **Pipeline Configuration** (`app/(admin)/admin/crm/settings/page.tsx`)
   - Customize milestone definitions
   - Set auto-advancement rules
   - Configure notifications

---

## 📡 API Endpoints Detail

### CRM Contacts API

```typescript
// app/api/crm/contacts/route.ts

import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  
  // Validate user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();
  
  if (!['warehouse_finder', 'reseller', 'root', 'warehouse_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Determine contact type based on role
  const contactType = profile.role === 'warehouse_finder' 
    ? 'warehouse_supplier' 
    : 'customer_lead';

  const { data, error } = await supabase
    .from('crm_contacts')
    .insert({
      ...body,
      created_by: user.id,
      company_id: profile.company_id,
      contact_type: contactType,
      pipeline_stage: 10,
      pipeline_milestone: 'contact_created',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const contactType = searchParams.get('contact_type');
  const pipelineStage = searchParams.get('pipeline_stage');

  let query = supabase
    .from('crm_contacts')
    .select('*, crm_activities(count)')
    .eq('created_by', user.id)
    .order('updated_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (contactType) query = query.eq('contact_type', contactType);
  if (pipelineStage) query = query.eq('pipeline_stage', parseInt(pipelineStage));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

---

### Location-Based Discovery API

```typescript
// app/api/crm/discover/warehouses/route.ts

import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { latitude, longitude, radius_km = 10 } = await request.json();

  // Find warehouses within radius using PostGIS
  const { data: warehouses, error } = await supabase.rpc(
    'find_warehouses_near_location',
    {
      lat: latitude,
      lng: longitude,
      radius_km: radius_km,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check which warehouses are already in CRM
  const { data: existingContacts } = await supabase
    .from('crm_contacts')
    .select('converted_to_warehouse_id')
    .eq('created_by', user.id)
    .not('converted_to_warehouse_id', 'is', null);

  const existingWarehouseIds = new Set(
    existingContacts?.map(c => c.converted_to_warehouse_id) || []
  );

  // Mark warehouses that are already in CRM
  const enrichedWarehouses = warehouses.map(wh => ({
    ...wh,
    in_crm: existingWarehouseIds.has(wh.id),
  }));

  return NextResponse.json(enrichedWarehouses);
}
```

---

## 🎨 UI Components

### Pipeline Kanban Board Component

```typescript
// components/crm/PipelineKanban.tsx

'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Calendar, MapPin } from 'lucide-react';

interface Contact {
  id: string;
  contact_name: string;
  company_name: string;
  pipeline_stage: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_contact_date: string;
  next_follow_up_date: string;
}

interface PipelineKanbanProps {
  contactType: 'warehouse_supplier' | 'customer_lead';
}

export function PipelineKanban({ contactType }: PipelineKanbanProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [milestones, setMilestones] = useState([]);

  const stages = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  useEffect(() => {
    fetchContacts();
    fetchMilestones();
  }, [contactType]);

  const fetchContacts = async () => {
    const response = await fetch(`/api/crm/contacts?contact_type=${contactType}`);
    const data = await response.json();
    setContacts(data);
  };

  const fetchMilestones = async () => {
    const response = await fetch(`/api/crm/pipeline/milestones?type=${contactType}`);
    const data = await response.json();
    setMilestones(data);
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStage = parseInt(destination.droppableId);

    // Update contact stage
    await fetch(`/api/crm/pipeline/${draggableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage }),
    });

    // Refresh contacts
    fetchContacts();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const milestone = milestones.find(m => m.stage_percentage === stage);
          const stageContacts = contacts.filter(c => c.pipeline_stage === stage);

          return (
            <div key={stage} className="flex-shrink-0 w-80">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm">{milestone?.milestone_name}</h3>
                    <p className="text-xs text-gray-500">{stage}%</p>
                  </div>
                  <Badge variant="secondary">{stageContacts.length}</Badge>
                </div>

                <Droppable droppableId={stage.toString()}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-[200px] ${
                        snapshot.isDraggingOver ? 'bg-blue-50' : ''
                      }`}
                    >
                      {stageContacts.map((contact, index) => (
                        <Draggable
                          key={contact.id}
                          draggableId={contact.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`cursor-move ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm">{contact.contact_name}</h4>
                                    <p className="text-xs text-gray-500">{contact.company_name}</p>
                                  </div>
                                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(contact.priority)}`} />
                                </div>

                                <div className="flex gap-1 mt-2">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Phone className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Mail className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <Calendar className="h-3 w-3" />
                                  </Button>
                                  {contactType === 'warehouse_supplier' && (
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <MapPin className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>

                                {contact.next_follow_up_date && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Follow-up: {new Date(contact.next_follow_up_date).toLocaleDateString()}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
```

---

### Warehouse Discovery Map Component

```typescript
// components/crm/warehouse-finder/DiscoveryMap.tsx

'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, MapPin, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface Warehouse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  in_crm: boolean;
  size_sqm: number;
  type: string;
}

export function DiscoveryMap() {
  const [userLocation, setUserLocation] = useState<[number, number]>([39.9334, 32.8597]); // Ankara default
  const [radius, setRadius] = useState(10); // km
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      });
    }
  }, []);

  const discoverWarehouses = async () => {
    setLoading(true);
    const response = await fetch('/api/crm/discover/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: userLocation[0],
        longitude: userLocation[1],
        radius_km: radius,
      }),
    });
    const data = await response.json();
    setWarehouses(data);
    setLoading(false);
  };

  const addToCRM = async (warehouse: Warehouse) => {
    await fetch('/api/crm/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: warehouse.name,
        company_name: warehouse.name,
        address: `${warehouse.latitude}, ${warehouse.longitude}`,
        location: `POINT(${warehouse.longitude} ${warehouse.latitude})`,
        warehouse_size_sqm: warehouse.size_sqm,
        warehouse_type: [warehouse.type],
      }),
    });
    
    // Refresh map
    discoverWarehouses();
  };

  return (
    <div className="relative h-[600px] w-full">
      <div className="absolute top-4 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            className="w-24"
            min="1"
            max="100"
          />
          <span className="text-sm">km</span>
          <Button onClick={discoverWarehouses} disabled={loading}>
            {loading ? 'Searching...' : 'Discover'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Found {warehouses.length} warehouses
        </p>
      </div>

      <MapContainer
        center={userLocation}
        zoom={12}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* User location */}
        <Marker position={userLocation}>
          <Popup>Your Location</Popup>
        </Marker>

        {/* Search radius */}
        <Circle
          center={userLocation}
          radius={radius * 1000}
          pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
        />

        {/* Warehouses */}
        {warehouses.map((warehouse) => (
          <Marker
            key={warehouse.id}
            position={[warehouse.latitude, warehouse.longitude]}
            icon={warehouse.in_crm ? greenIcon : yellowIcon}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">{warehouse.name}</h3>
                <p className="text-sm text-gray-600">{warehouse.size_sqm} m²</p>
                <p className="text-sm text-gray-600">{warehouse.type}</p>
                {warehouse.in_crm ? (
                  <Badge variant="success" className="mt-2">In CRM</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => addToCRM(warehouse)}
                    className="mt-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add to CRM
                  </Button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
```

---

## 🔒 RLS Policies

```sql
-- RLS Policies for crm_contacts

-- Warehouse finders and resellers can view their own contacts
CREATE POLICY "Users can view own contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Users can create contacts
CREATE POLICY "Users can create contacts"
ON crm_contacts FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('warehouse_finder', 'reseller', 'root', 'warehouse_admin')
  )
);

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
ON crm_contacts FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Admins can view all contacts in their company
CREATE POLICY "Admins can view company contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('root', 'warehouse_admin', 'warehouse_owner')
    AND company_id = crm_contacts.company_id
  )
);

-- Root can view all contacts
CREATE POLICY "Root can view all contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'root'
  )
);

-- Similar policies for crm_activities and crm_performance_metrics
```

---

## 📊 Success Metrics & KPIs

### Warehouse Finder KPIs:
- **Contacts Created per Month**: Target 20-30
- **Site Visits per Month**: Target 10-15
- **Conversion Rate**: Target 15-20% (contact → first reservation)
- **Average Time to Convert**: Target 45-60 days
- **Admin Approval Rate**: Target 70%+
- **Active Pipeline Value**: Number of contacts at 50%+ stage

### Reseller KPIs:
- **Leads Created per Month**: Target 30-40
- **Outreach Activities per Day**: Target 15-20 (calls + emails)
- **Conversion Rate**: Target 10-15% (lead → first purchase)
- **Average Deal Size**: Track revenue per converted customer
- **Average Sales Cycle**: Target 30-45 days
- **Pipeline Value**: Total potential revenue in pipeline

---

## 🚀 Next Steps

1. **Review & Approve**: Get stakeholder approval on role definitions and workflows
2. **Database Migration**: Create and test all database tables and RLS policies
3. **API Development**: Build and test all API endpoints
4. **UI Development**: Create reusable components and dashboard pages
5. **Integration**: Connect with existing warehouse and booking systems
6. **Testing**: Comprehensive testing of CRM workflows
7. **Training**: Create documentation and training materials for new roles
8. **Launch**: Phased rollout with pilot users

---

## 📝 Notes

- Both roles require approval from admin before certain actions (adding warehouses to system, high-value deals)
- System should track ALL activities for compliance and performance review
- Email integration should track opens/clicks for better follow-up
- Mobile app consideration for field work (visits, on-site documentation)
- Gamification elements could be added (leaderboards, badges, achievements)
- Integration with external CRM tools (export/import) for existing workflows

---

**Document Status**: Ready for Implementation  
**Estimated Development Time**: 6-8 weeks  
**Required Team**: 2 Backend Developers, 2 Frontend Developers, 1 UI/UX Designer, 1 QA Engineer

