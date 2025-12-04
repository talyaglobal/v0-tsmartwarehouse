# TSmart Warehouse Management System - API Documentation

**Version:** 1.0.0  
**Base URL:** `/api/v1`  
**Authentication:** Bearer Token (Supabase JWT)

---

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Bookings](#bookings)
  - [Tasks](#tasks)
  - [Incidents](#incidents)
  - [Claims](#claims)
  - [Invoices](#invoices)
  - [Notifications](#notifications)
  - [File Upload](#file-upload)

---

## Authentication

Most endpoints require authentication using Supabase JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

1. Register/Login via `/login` or `/register` pages
2. Token is automatically stored in cookies (httpOnly)
3. For API testing, extract token from browser cookies or use Supabase client

---

## Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "total": 10
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Endpoints

### Health Check

#### `GET /api/health`

Check system health status.

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "storage": "operational"
  }
}
```

---

### Bookings

#### `GET /api/v1/bookings`

List all bookings with optional filters.

**Authentication:** Required

**Query Parameters:**
- `customerId` (string, optional) - Filter by customer ID
- `status` (string, optional) - Filter by status: `pending`, `confirmed`, `active`, `completed`, `cancelled`
- `type` (string, optional) - Filter by type: `pallet`, `area-rental`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customer_name": "John Doe",
      "customer_email": "john@example.com",
      "warehouse_id": "uuid",
      "type": "pallet",
      "status": "active",
      "pallet_count": 50,
      "area_sq_ft": null,
      "floor_number": null,
      "hall_id": null,
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "total_amount": 875.00,
      "notes": "Fragile items",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

#### `POST /api/v1/bookings`

Create a new booking.

**Authentication:** Required (Customer role)

**Request Body:**
```json
{
  "type": "pallet",  // or "area-rental"
  "palletCount": 50,  // required for pallet type
  "areaSqFt": 40000,  // required for area-rental type (min 40000)
  "floorNumber": 3,  // optional, required for area-rental
  "hallId": "uuid",  // optional, required for area-rental
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",  // optional
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Booking created successfully"
}
```

**Validation:**
- `type` is required
- For `pallet` type: `palletCount` is required
- For `area-rental` type: `areaSqFt` (min 40,000), `floorNumber`, and `hallId` are required
- `startDate` is required

#### `GET /api/v1/bookings/[id]`

Get booking details by ID.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

#### `PATCH /api/v1/bookings/[id]`

Update a booking.

**Authentication:** Required

**Request Body:** (all fields optional)
```json
{
  "status": "confirmed",
  "notes": "Updated notes",
  "endDate": "2024-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Booking updated successfully"
}
```

#### `DELETE /api/v1/bookings/[id]`

Delete a booking.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Booking deleted successfully"
}
```

---

### Tasks

#### `GET /api/v1/tasks`

List all tasks with optional filters.

**Authentication:** Required

**Query Parameters:**
- `assignedTo` (string, optional) - Filter by assigned worker ID
- `status` (string, optional) - Filter by status: `pending`, `assigned`, `in-progress`, `completed`, `cancelled`
- `priority` (string, optional) - Filter by priority: `low`, `medium`, `high`, `urgent`
- `warehouseId` (string, optional) - Filter by warehouse ID
- `bookingId` (string, optional) - Filter by booking ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "receiving",
      "title": "Receive shipment",
      "description": "Receive 50 pallets",
      "status": "in-progress",
      "priority": "high",
      "assigned_to": "uuid",
      "assigned_to_name": "Worker Name",
      "booking_id": "uuid",
      "warehouse_id": "uuid",
      "zone": "A1",
      "location": "Floor 1, Hall A",
      "due_date": "2024-12-31T23:59:59Z",
      "completed_at": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

#### `POST /api/v1/tasks`

Create a new task.

**Authentication:** Required (Admin/Worker role)

**Request Body:**
```json
{
  "type": "receiving",  // required: receiving, putaway, picking, packing, shipping, inventory-check, maintenance
  "title": "Receive shipment",  // required
  "description": "Receive 50 pallets",  // required
  "warehouseId": "uuid",  // required
  "status": "pending",  // optional, defaults to "pending"
  "priority": "high",  // optional: low, medium, high, urgent
  "assignedTo": "uuid",  // optional
  "bookingId": "uuid",  // optional
  "zone": "A1",  // optional
  "location": "Floor 1, Hall A",  // optional
  "dueDate": "2024-12-31T23:59:59Z"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Task created successfully"
}
```

---

### Incidents

#### `GET /api/v1/incidents`

List all incidents with optional filters.

**Authentication:** Required

**Query Parameters:**
- `status` (string, optional) - Filter by status: `open`, `investigating`, `resolved`, `closed`
- `severity` (string, optional) - Filter by severity: `low`, `medium`, `high`, `critical`
- `reportedBy` (string, optional) - Filter by reporter ID
- `warehouseId` (string, optional) - Filter by warehouse ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "damage",
      "title": "Pallet damage",
      "description": "Pallet damaged during handling",
      "severity": "medium",
      "status": "open",
      "reported_by": "uuid",
      "reported_by_name": "Worker Name",
      "warehouse_id": "uuid",
      "location": "Floor 1, Hall A",
      "affected_booking_id": "uuid",
      "resolution": null,
      "created_at": "2024-01-01T00:00:00Z",
      "resolved_at": null
    }
  ],
  "total": 1
}
```

#### `POST /api/v1/incidents`

Create a new incident.

**Authentication:** Required

**Request Body:**
```json
{
  "type": "damage",  // required
  "title": "Pallet damage",  // required
  "description": "Pallet damaged during handling",  // required
  "severity": "medium",  // required: low, medium, high, critical
  "warehouseId": "uuid",  // required
  "location": "Floor 1, Hall A",  // optional
  "affectedBookingId": "uuid",  // optional
  "status": "open"  // optional, defaults to "open"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Incident created successfully"
}
```

---

### Claims

#### `GET /api/v1/claims`

List all claims with optional filters.

**Authentication:** Required

**Query Parameters:**
- `customerId` (string, optional) - Filter by customer ID
- `status` (string, optional) - Filter by status: `submitted`, `under-review`, `approved`, `rejected`, `paid`
- `bookingId` (string, optional) - Filter by booking ID
- `incidentId` (string, optional) - Filter by incident ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customer_name": "John Doe",
      "incident_id": "uuid",
      "booking_id": "uuid",
      "type": "damage",
      "description": "Goods damaged during storage",
      "amount": 500.00,
      "status": "submitted",
      "evidence": ["url1", "url2"],
      "resolution": null,
      "approved_amount": null,
      "created_at": "2024-01-01T00:00:00Z",
      "resolved_at": null
    }
  ],
  "total": 1
}
```

#### `POST /api/v1/claims`

Create a new claim.

**Authentication:** Required (Customer role)

**Request Body:**
```json
{
  "type": "damage",  // required
  "description": "Goods damaged during storage",  // required
  "bookingId": "uuid",  // required
  "amount": 500.00,  // required
  "incidentId": "uuid",  // optional
  "evidence": ["url1", "url2"],  // optional array of file URLs
  "status": "submitted"  // optional, defaults to "submitted"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Claim submitted successfully"
}
```

---

### Invoices

#### `GET /api/v1/invoices`

List all invoices with optional filters.

**Authentication:** Required

**Query Parameters:**
- `customerId` (string, optional) - Filter by customer ID
- `status` (string, optional) - Filter by status: `draft`, `pending`, `paid`, `overdue`, `cancelled`
- `bookingId` (string, optional) - Filter by booking ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "booking_id": "uuid",
      "customer_id": "uuid",
      "customer_name": "John Doe",
      "status": "pending",
      "items": [
        {
          "description": "Pallet storage",
          "quantity": 50,
          "unit_price": 17.50,
          "total": 875.00
        }
      ],
      "subtotal": 875.00,
      "tax": 87.50,
      "total": 962.50,
      "due_date": "2024-12-31",
      "paid_date": null,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

---

### Notifications

#### `GET /api/v1/notifications`

List notifications for the authenticated user.

**Authentication:** Required

**Query Parameters:**
- `read` (boolean, optional) - Filter by read status
- `type` (string, optional) - Filter by type: `booking`, `invoice`, `task`, `incident`, `system`
- `channel` (string, optional) - Filter by channel: `email`, `sms`, `push`, `whatsapp`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "booking",
      "channel": "email",
      "title": "Booking Confirmed",
      "message": "Your booking has been confirmed",
      "read": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

#### `POST /api/v1/notifications`

Create a notification (Admin only).

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "userId": "uuid",  // required
  "type": "booking",  // required
  "channel": "email",  // required
  "title": "Booking Confirmed",  // required
  "message": "Your booking has been confirmed"  // required
}
```

#### `PATCH /api/v1/notifications/[id]/read`

Mark a notification as read.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### File Upload

#### `POST /api/v1/files/upload`

Upload a file (for claim evidence, etc.).

**Authentication:** Required

**Request:** `multipart/form-data`
- `file` (File, required) - The file to upload
- `folder` (string, optional) - Folder path in storage (default: "uploads")

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.supabase.co/...",
    "path": "uploads/filename.jpg",
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

**File Restrictions:**
- Max file size: 10MB
- Allowed types: Images (jpg, png, gif, webp), Documents (pdf, doc, docx)

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Default:** 100 requests per minute per IP
- **Authenticated:** 200 requests per minute per user
- **Admin:** 500 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

---

## Pagination

Currently, endpoints return all matching results. Pagination will be added in a future update with:
- `page` query parameter (default: 1)
- `limit` query parameter (default: 20, max: 100)
- Response will include `page`, `limit`, `total`, `totalPages`

---

## Webhooks

Webhook support is planned for future releases to notify external systems of:
- Booking status changes
- Invoice generation
- Incident creation
- Claim status updates

---

## Changelog

### v1.0.0 (December 2024)
- Initial API release
- Bookings, Tasks, Incidents, Claims, Invoices endpoints
- File upload support
- Notification system

