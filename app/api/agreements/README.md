# Agreement Management API

> Complete REST API for managing legal agreements and tracking acceptances

**Version**: 1.0  
**Status**: Production Ready (except PDF generation)  
**Created**: January 10, 2026

---

## 📁 Directory Structure

```
app/api/agreements/
├── README.md (this file)
├── route.ts                      # Legacy: Get agreements / statuses
├── accept/route.ts               # Legacy: Accept agreement
├── versions/
│   ├── route.ts                  # List/Create versions
│   └── [id]/route.ts            # Get/Update/Delete version
├── user-agreements/
│   └── route.ts                  # List/Record user acceptances
├── warehouse-agreements/
│   └── route.ts                  # List/Record warehouse acceptances
├── booking-agreements/
│   └── route.ts                  # List/Record booking acceptances
├── check/route.ts                # Check agreement status
├── seed/route.ts                 # Seed from templates
├── generate-pdf/route.ts         # Generate PDF (placeholder)
├── download/
│   └── [id]/route.ts            # Download agreement
└── stats/route.ts                # Acceptance statistics
```

---

## 🚀 Quick Start

### 1. Seed Initial Agreements

```bash
curl -X POST http://localhost:3000/api/agreements/seed \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"force": false, "language": "en"}'
```

### 2. Get Latest Agreement

```bash
curl http://localhost:3000/api/agreements?type=tos \
  -H "Authorization: Bearer <user_token>"
```

### 3. Record Acceptance

```bash
curl -X POST http://localhost:3000/api/agreements/user-agreements \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agreementVersionId": "uuid",
    "signatureText": "John Doe"
  }'
```

---

## 📚 Endpoints Overview

### Core Operations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/versions` | List agreement versions | User |
| POST | `/versions` | Create new version | Admin |
| GET | `/versions/[id]` | Get version details | User |
| PATCH | `/versions/[id]` | Update version | Admin |
| DELETE | `/versions/[id]` | Deactivate version | Admin |

### Acceptance Tracking

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/user-agreements` | List user acceptances | User |
| POST | `/user-agreements` | Record acceptance | User |
| GET | `/warehouse-agreements` | List warehouse acceptances | Owner/Admin |
| POST | `/warehouse-agreements` | Record acceptance | Owner |
| GET | `/booking-agreements` | List booking acceptances | Customer/Owner |
| POST | `/booking-agreements` | Record acceptance | Customer |

### Utilities

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/check` | Check agreement status | User |
| POST | `/seed` | Seed from templates | Admin |
| POST | `/generate-pdf` | Generate PDF | Admin |
| GET | `/download/[id]` | Download agreement | User |
| GET | `/stats` | Get statistics | Admin |

---

## 🔐 Authentication

All endpoints require Supabase authentication:

```typescript
// Client-side
const supabase = createClientSupabaseClient();
const { data: { session } } = await supabase.auth.getSession();

fetch('/api/agreements/versions', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
});
```

---

## 🎯 Common Use Cases

### Use Case 1: Registration with ToS

```typescript
// 1. Get latest ToS
const { data: tos } = await fetch('/api/agreements?type=tos')
  .then(r => r.json());

// 2. Show modal with tos.content

// 3. Record acceptance
await fetch('/api/agreements/user-agreements', {
  method: 'POST',
  body: JSON.stringify({
    agreementVersionId: tos.id,
    signatureText: userName,
  }),
});
```

### Use Case 2: Booking with Agreements

```typescript
// 1. Check required agreements
const { allAccepted, agreements } = await fetch('/api/agreements/check', {
  method: 'POST',
  body: JSON.stringify({
    agreementTypes: ['customer_booking', 'cancellation_refund'],
    context: { bookingId: 'booking-123' },
  }),
}).then(r => r.json());

// 2. If not all accepted, show modals and record acceptances

// 3. Proceed with booking
```

### Use Case 3: Warehouse Listing

```typescript
// 1. Check owner agreements
const { allAccepted } = await fetch('/api/agreements/check', {
  method: 'POST',
  body: JSON.stringify({
    agreementTypes: [
      'warehouse_owner_service',
      'sla',
      'insurance_liability'
    ],
    context: { warehouseId: 'warehouse-123' },
  }),
}).then(r => r.json());

// 2. If not accepted, show agreements

// 3. Record acceptances via /warehouse-agreements

// 4. Allow warehouse listing
```

---

## 📊 Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": "Optional details"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Server Error

---

## 🔧 Development

### Adding a New Agreement Type

1. Add to `AgreementType` enum in `features/agreements/types.ts`
2. Create markdown template in `features/agreements/templates/`
3. Run seed endpoint to create version 1.0
4. Update documentation

### Creating a New Version

```typescript
// Via API
await fetch('/api/agreements/versions', {
  method: 'POST',
  body: JSON.stringify({
    agreementType: 'tos',
    version: '1.1',
    title: 'Terms of Service',
    content: markdownContent,
    isMajorVersion: false,
    effectiveDate: '2026-02-01',
    language: 'en',
  }),
});
```

### Testing Locally

```bash
# Start dev server
npm run dev

# Test endpoints with curl or Postman
curl http://localhost:3000/api/agreements/versions

# Or use the test script
npm run test:api
```

---

## 📝 Database Schema

### Tables Used

- `agreement_versions` - Agreement templates
- `user_agreements` - User acceptances
- `warehouse_agreements` - Warehouse acceptances
- `booking_agreements` - Booking acceptances
- `profiles` - User data (JSONB cache)
- `warehouses` - Warehouse data (JSONB cache)
- `bookings` - Booking data (JSONB cache)

### Functions Used

- `get_latest_agreement_version()` - Get latest version
- `has_user_accepted_agreement()` - Check acceptance

---

## 🚨 Important Notes

### JSONB Caching

Acceptances are cached in JSONB fields for performance:

```sql
-- profiles.agreements_accepted
{
  "tos": {
    "version": "1.0",
    "accepted_at": "2026-01-10T10:00:00Z",
    "ip": "192.168.1.1"
  }
}

-- warehouses.owner_agreements
{
  "warehouse_owner_service": {
    "version": "1.0",
    "accepted_at": "2026-01-10T10:00:00Z",
    "accepted_by": "uuid"
  }
}

-- bookings.booking_agreements
{
  "customer_booking": {
    "version": "1.0",
    "accepted_at": "2026-01-10T10:00:00Z"
  }
}
```

### Duplicate Prevention

All acceptance endpoints prevent duplicates:

```typescript
// Returns 409 Conflict if already accepted
{
  "error": "Agreement already accepted"
}
```

### IP & User Agent Capture

Automatically captured for audit trail:

```typescript
const ip = request.headers.get('x-forwarded-for') || 'unknown';
const userAgent = request.headers.get('user-agent') || 'unknown';
```

---

## 🔗 Related Documentation

- [Full API Documentation](../../../documents/AGREEMENT_API_DOCUMENTATION.md)
- [Online Agreements List](../../../documents/ONLINE_AGREEMENTS.md)
- [Implementation Status](../../../documents/IMPLEMENTATION_GAP_ANALYSIS.md)
- [API Creation Summary](../../../documents/API_CREATION_SUMMARY.md)

---

## 🐛 Known Issues

1. **PDF Generation**: Not yet implemented (placeholder only)
2. **Rate Limiting**: Not implemented (add in production)
3. **Webhooks**: Not implemented (future feature)
4. **Multi-language**: Only English supported currently

---

## 🎯 TODO

### High Priority
- [ ] Implement PDF generation
- [ ] Add rate limiting
- [ ] Write unit tests
- [ ] Write integration tests

### Medium Priority
- [ ] Add webhooks
- [ ] Add multi-language support
- [ ] Create admin UI
- [ ] Add caching layer

### Low Priority
- [ ] Add GraphQL API
- [ ] Add batch operations
- [ ] Add export functionality
- [ ] Add analytics dashboard

---

## 📞 Support

For questions or issues:
1. Check [API Documentation](../../../documents/AGREEMENT_API_DOCUMENTATION.md)
2. Review [Examples](#-common-use-cases)
3. Check console logs for errors
4. Contact development team

---

**Last Updated**: January 10, 2026  
**Maintained By**: Development Team  
**Status**: ✅ Production Ready
