# API Middleware

This directory contains middleware utilities for API routes.

## Components

### `api-wrapper.ts`
Main wrapper for API route handlers that provides:
- CORS handling
- Rate limiting
- Authentication/authorization
- Error handling

**Usage:**
```typescript
import { withApiMiddleware, apiResponse } from '@/lib/middleware/api-wrapper'

export const GET = withApiMiddleware(
  async (request, { user }) => {
    // Your handler code
    return apiResponse({ data: 'success' })
  },
  {
    requireAuth: true,
    requireRole: 'admin',
    rateLimit: 'api',
    methods: ['GET'],
  }
)
```

### `rate-limit.ts`
Rate limiting middleware using Upstash Redis (production) or in-memory (development).

**Presets:**
- `api`: 100 requests per minute
- `auth`: 5 requests per minute
- `public`: 200 requests per minute
- `admin`: 500 requests per minute

### `cors.ts`
CORS configuration and header management.

## Environment Variables

Required for rate limiting (optional):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If not provided, falls back to in-memory rate limiting.

