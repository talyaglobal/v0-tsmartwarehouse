# Agreement Management API Documentation

> Complete API reference for the agreement management system

Last Updated: January 10, 2026

---

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Agreement Versions](#agreement-versions)
  - [User Agreements](#user-agreements)
  - [Warehouse Agreements](#warehouse-agreements)
  - [Booking Agreements](#booking-agreements)
  - [Agreement Utilities](#agreement-utilities)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The Agreement Management API provides endpoints for managing legal agreements, tracking acceptances, and ensuring compliance across the TSmart Warehouse platform.

**Base URL**: `/api/agreements`

**Authentication**: All endpoints require authentication via Supabase Auth

---

## Authentication

All requests must include a valid Supabase session cookie or Authorization header:

```
Authorization: Bearer <supabase_access_token>
```

---

## API Endpoints

### Agreement Versions

#### GET /api/agreements/versions

Get all agreement versions or filter by type.

**Query Parameters**:
- `type` (optional): Agreement type to filter by
- `language` (optional): Language code (default: 'en')
- `includeInactive` (optional): Include inactive versions (default: false)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "agreement_type": "tos",
      "version": "1.0",
      "title": "Terms of Service",
      "content": "markdown content...",
      "pdf_url": "https://...",
      "is_major_version": true,
      "effective_date": "2026-01-10",
      "expiry_date": null,
      "language": "en",
      "is_active": true,
      "is_draft": false,
      "created_at": "2026-01-10T10:00:00Z",
      "updated_at": "2026-01-10T10:00:00Z"
    }
  ]
}
```

---

#### POST /api/agreements/versions

Create a new agreement version (admin only).

**Request Body**:
```json
{
  "agreementType": "tos",
  "version": "1.1",
  "title": "Terms of Service",
  "content": "markdown content...",
  "isMajorVersion": false,
  "effectiveDate": "2026-02-01",
  "expiryDate": null,
  "language": "en",
  "isActive": true,
  "isDraft": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "agreement_type": "tos",
    "version": "1.1",
    ...
  }
}
```

**Status Codes**:
- `201`: Created successfully
- `400`: Missing required fields
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

---

#### GET /api/agreements/versions/[id]

Get a specific agreement version by ID.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "agreement_type": "tos",
    "version": "1.0",
    ...
  }
}
```

---

#### PATCH /api/agreements/versions/[id]

Update an agreement version (admin only).

**Request Body** (partial update):
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "is_active": false
}
```

**Allowed Fields**:
- `title`
- `content`
- `pdf_url`
- `is_active`
- `is_draft`
- `expiry_date`

---

#### DELETE /api/agreements/versions/[id]

Soft delete (deactivate) an agreement version (admin only).

**Response**:
```json
{
  "success": true,
  "message": "Agreement version deactivated"
}
```

---

### User Agreements

#### GET /api/agreements/user-agreements

Get all agreement acceptances for the current user.

**Query Parameters**:
- `type` (optional): Filter by agreement type

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "agreement_version_id": "uuid",
      "accepted_at": "2026-01-10T10:00:00Z",
      "accepted_ip": "192.168.1.1",
      "accepted_user_agent": "Mozilla/5.0...",
      "acceptance_method": "web",
      "signature_text": "John Doe",
      "signature_method": "typed",
      "metadata": {},
      "agreement_version": {
        "agreement_type": "tos",
        "version": "1.0",
        "title": "Terms of Service"
      }
    }
  ]
}
```

---

#### POST /api/agreements/user-agreements

Record a new agreement acceptance.

**Request Body**:
```json
{
  "agreementVersionId": "uuid",
  "signatureText": "John Doe",
  "signatureMethod": "typed",
  "metadata": {
    "device": "desktop",
    "browser": "Chrome"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "agreement_version_id": "uuid",
    "accepted_at": "2026-01-10T10:00:00Z",
    ...
  }
}
```

**Status Codes**:
- `201`: Created successfully
- `400`: Missing required fields
- `401`: Unauthorized
- `409`: Agreement already accepted
- `500`: Server error

**Notes**:
- IP address and user agent are automatically captured
- Acceptance is also cached in `profiles.agreements_accepted` JSONB field

---

### Warehouse Agreements

#### GET /api/agreements/warehouse-agreements

Get agreement acceptances for a specific warehouse.

**Query Parameters**:
- `warehouseId` (required): Warehouse ID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "warehouse_id": "uuid",
      "agreement_version_id": "uuid",
      "accepted_by": "uuid",
      "accepted_at": "2026-01-10T10:00:00Z",
      "agreement_version": {
        "agreement_type": "warehouse_owner_service",
        "version": "1.0"
      },
      "accepted_by_profile": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

**Authorization**:
- Warehouse owner (via company_id)
- Platform admin

---

#### POST /api/agreements/warehouse-agreements

Record warehouse agreement acceptance.

**Request Body**:
```json
{
  "warehouseId": "uuid",
  "agreementVersionId": "uuid",
  "signatureText": "John Doe",
  "signatureMethod": "typed",
  "metadata": {}
}
```

**Authorization**:
- Must be warehouse owner

---

### Booking Agreements

#### GET /api/agreements/booking-agreements

Get agreement acceptances for a specific booking.

**Query Parameters**:
- `bookingId` (required): Booking ID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "booking_id": "booking-123",
      "agreement_version_id": "uuid",
      "accepted_by": "uuid",
      "accepted_at": "2026-01-10T10:00:00Z",
      "agreement_version": {
        "agreement_type": "customer_booking",
        "version": "1.0"
      }
    }
  ]
}
```

**Authorization**:
- Booking customer
- Warehouse owner
- Platform admin

---

#### POST /api/agreements/booking-agreements

Record booking agreement acceptance.

**Request Body**:
```json
{
  "bookingId": "booking-123",
  "agreementVersionId": "uuid",
  "signatureText": "Jane Smith",
  "signatureMethod": "typed",
  "metadata": {}
}
```

**Authorization**:
- Must be booking customer

---

### Agreement Utilities

#### GET /api/agreements

Get agreement information or user statuses.

**Query Parameters**:
- `type` (optional): Agreement type to get latest version
- `language` (optional): Language code (default: 'en')
- `action` (optional): 'statuses' to get all user agreement statuses

**Examples**:

Get latest ToS version:
```
GET /api/agreements?type=tos&language=en
```

Get all user agreement statuses:
```
GET /api/agreements?action=statuses
```

---

#### POST /api/agreements/accept

Accept an agreement (legacy endpoint, use user-agreements instead).

---

#### POST /api/agreements/check

Check if user needs to accept agreements.

**Request Body**:
```json
{
  "agreementTypes": ["tos", "privacy_policy", "customer_booking"],
  "context": {
    "warehouseId": "uuid",
    "bookingId": "booking-123"
  }
}
```

**Response**:
```json
{
  "success": true,
  "allAccepted": false,
  "needsAction": true,
  "agreements": {
    "tos": {
      "required": true,
      "accepted": true,
      "needsReacceptance": false,
      "currentVersion": "1.0",
      "acceptedAt": "2026-01-10T10:00:00Z"
    },
    "privacy_policy": {
      "required": true,
      "accepted": false,
      "needsReacceptance": true,
      "currentVersion": "1.1",
      "latestVersion": "1.1"
    },
    "customer_booking": {
      "required": true,
      "accepted": false,
      "needsReacceptance": true,
      "currentVersion": "1.0"
    }
  }
}
```

**Notes**:
- Automatically checks context-specific agreements (warehouse, booking)
- Returns detailed status for each agreement type

---

#### POST /api/agreements/seed

Seed initial agreement versions from templates (admin only).

**Request Body**:
```json
{
  "force": false,
  "language": "en"
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "type": "tos",
      "status": "created",
      "message": "Version 1.0 created"
    },
    {
      "type": "privacy_policy",
      "status": "skipped",
      "message": "Version 1.0 already exists"
    }
  ],
  "errors": [],
  "summary": {
    "total": 5,
    "created": 3,
    "updated": 0,
    "skipped": 2,
    "failed": 0
  }
}
```

**Notes**:
- Reads markdown files from `features/agreements/templates/`
- Set `force: true` to update existing versions
- Only seeds templates that exist as files

---

#### POST /api/agreements/generate-pdf

Generate PDF from agreement markdown (admin only).

**Request Body**:
```json
{
  "agreementVersionId": "uuid"
}
```

**Response**:
```json
{
  "success": false,
  "message": "PDF generation not yet implemented",
  "todo": [
    "Install puppeteer or similar PDF generation library",
    "Create HTML template for agreements",
    ...
  ]
}
```

**Status**: Not yet implemented (placeholder)

---

#### GET /api/agreements/download/[id]

Download agreement as PDF or markdown.

**Query Parameters**:
- `format`: 'pdf' or 'markdown' (default: 'pdf')

**Examples**:

Download as PDF:
```
GET /api/agreements/download/uuid?format=pdf
```

Download as markdown:
```
GET /api/agreements/download/uuid?format=markdown
```

**Response**:
- PDF: Redirects to Supabase Storage URL
- Markdown: Returns file download

---

#### GET /api/agreements/stats

Get agreement acceptance statistics (admin only).

**Query Parameters**:
- `type` (optional): Filter by agreement type

**Response**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 1250,
      "totalUserAgreements": 3500,
      "totalWarehouseAgreements": 450,
      "totalBookingAgreements": 2100,
      "overallAcceptanceRate": "280.00"
    },
    "byType": {
      "tos": {
        "type": "tos",
        "count": 1200,
        "acceptanceRate": "96.00",
        "recentAcceptances": ["2026-01-10T10:00:00Z", ...]
      },
      "privacy_policy": {
        "type": "privacy_policy",
        "count": 1200,
        "acceptanceRate": "96.00",
        "recentAcceptances": [...]
      }
    },
    "trends": {
      "last30Days": {
        "2026-01-10": 45,
        "2026-01-09": 38,
        ...
      },
      "recentAcceptances": [...]
    }
  }
}
```

---

## Data Models

### Agreement Version

```typescript
{
  id: string;
  agreement_type: AgreementType;
  version: string; // Format: "MAJOR.MINOR"
  title: string;
  content: string; // Markdown
  pdf_url?: string;
  is_major_version: boolean;
  effective_date: string; // ISO date
  expiry_date?: string; // ISO date
  language: string; // ISO 639-1 code
  is_active: boolean;
  is_draft: boolean;
  created_at: string; // ISO timestamp
  created_by?: string;
  updated_at: string; // ISO timestamp
}
```

### User Agreement

```typescript
{
  id: string;
  user_id: string;
  agreement_version_id: string;
  accepted_at: string; // ISO timestamp
  accepted_ip?: string;
  accepted_user_agent?: string;
  acceptance_method: 'web' | 'mobile_app' | 'api';
  signature_text?: string;
  signature_method: 'typed' | 'kolaysign' | 'eid';
  metadata?: Record<string, any>;
  created_at: string; // ISO timestamp
}
```

### Agreement Types

```typescript
enum AgreementType {
  // User Agreements
  TERMS_OF_SERVICE = 'tos',
  PRIVACY_POLICY = 'privacy_policy',
  COOKIE_POLICY = 'cookie_policy',
  PAYMENT_PROCESSING = 'payment_processing',
  DATA_PROCESSING = 'dpa',
  NON_DISCLOSURE = 'nda',
  
  // Warehouse Owner Agreements
  WAREHOUSE_OWNER_SERVICE = 'warehouse_owner_service',
  SERVICE_LEVEL_AGREEMENT = 'sla',
  INSURANCE_LIABILITY = 'insurance_liability',
  CONTENT_LISTING = 'content_listing',
  
  // Booking Agreements
  CUSTOMER_BOOKING = 'customer_booking',
  CANCELLATION_REFUND = 'cancellation_refund',
  ESCROW = 'escrow',
  RESELLER_CUSTOMER = 'reseller_customer',
  
  // Role-Specific Agreements
  RESELLER_PARTNERSHIP = 'reseller_partnership',
  WAREHOUSE_FINDER = 'warehouse_finder',
  AFFILIATE_MARKETING = 'affiliate_marketing',
  
  // Platform Policies
  REVIEW_RATING = 'review_rating',
  ANTI_DISCRIMINATION = 'anti_discrimination',
  DISPUTE_RESOLUTION = 'dispute_resolution',
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Optional additional details"
}
```

### Common Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate)
- `500`: Internal Server Error

---

## Examples

### Complete Flow: User Accepting ToS

```typescript
// 1. Get latest ToS version
const versionResponse = await fetch('/api/agreements?type=tos');
const { data: version } = await versionResponse.json();

// 2. Display agreement to user
// (show version.content in modal)

// 3. User accepts
const acceptResponse = await fetch('/api/agreements/user-agreements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agreementVersionId: version.id,
    signatureText: 'John Doe',
    signatureMethod: 'typed',
  }),
});

const { data: acceptance } = await acceptResponse.json();
console.log('Accepted at:', acceptance.accepted_at);
```

---

### Complete Flow: Booking with Agreements

```typescript
// 1. Check required agreements for booking
const checkResponse = await fetch('/api/agreements/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agreementTypes: ['customer_booking', 'cancellation_refund'],
    context: { bookingId: 'booking-123' },
  }),
});

const { allAccepted, agreements } = await checkResponse.json();

if (!allAccepted) {
  // 2. Get missing agreements and show to user
  for (const [type, status] of Object.entries(agreements)) {
    if (status.needsReacceptance) {
      // Get latest version and show modal
      const versionResponse = await fetch(`/api/agreements?type=${type}`);
      const { data: version } = await versionResponse.json();
      
      // Show modal, get user acceptance
      
      // 3. Record acceptance
      await fetch('/api/agreements/booking-agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 'booking-123',
          agreementVersionId: version.id,
          signatureText: 'Jane Smith',
        }),
      });
    }
  }
}

// 4. Proceed with booking
```

---

### Admin: Seeding Agreements

```typescript
// Seed all agreement templates
const seedResponse = await fetch('/api/agreements/seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    force: false, // Don't overwrite existing
    language: 'en',
  }),
});

const { summary, results, errors } = await seedResponse.json();
console.log(`Created: ${summary.created}, Skipped: ${summary.skipped}`);
```

---

### Admin: Getting Statistics

```typescript
// Get overall stats
const statsResponse = await fetch('/api/agreements/stats');
const { data } = await statsResponse.json();

console.log('Total users:', data.overview.totalUsers);
console.log('Acceptance rate:', data.overview.overallAcceptanceRate + '%');

// Get stats for specific agreement
const tosStatsResponse = await fetch('/api/agreements/stats?type=tos');
const { data: tosData } = await tosStatsResponse.json();
console.log('ToS acceptances:', tosData.byType.tos.count);
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting in production:

- User endpoints: 100 requests/minute
- Admin endpoints: 1000 requests/minute
- Seed endpoint: 10 requests/hour

---

## Webhooks

Currently no webhooks are implemented. Future consideration:

- `agreement.accepted` - Fired when user accepts agreement
- `agreement.version.created` - Fired when new version is created
- `agreement.version.activated` - Fired when version becomes active

---

## See Also

- [Online Agreements Master List](./ONLINE_AGREEMENTS.md)
- [Implementation Gap Analysis](./IMPLEMENTATION_GAP_ANALYSIS.md)
- [Agreement Implementation Status](../features/agreements/IMPLEMENTATION_STATUS.md)

---

**Last Updated**: January 10, 2026  
**API Version**: 1.0  
**Status**: Production Ready (except PDF generation)
