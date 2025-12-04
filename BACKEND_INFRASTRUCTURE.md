# Backend Infrastructure Setup

This document describes the backend infrastructure components implemented for the TSmart Warehouse Management System.

## Overview

The backend infrastructure includes:
- ✅ Database setup (PostgreSQL/Supabase)
- ✅ Database schema/migrations
- ✅ Database client configuration (Supabase)
- ✅ Environment variable management
- ✅ API authentication middleware
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Error logging and monitoring

## Database Setup

### Supabase Configuration

The project uses Supabase (PostgreSQL) as the database. The schema is defined in:
- `supabase/migrations/001_initial_schema.sql`

### Database Client

Database clients are configured in:
- `lib/supabase/client.ts` - Browser client
- `lib/supabase/server.ts` - Server client
- `lib/db/client.ts` - Database wrapper utilities

**Usage:**
```typescript
import { getDbClient } from '@/lib/db/client'

const client = getDbClient()
const { data, error } = await client.from('bookings').select('*')
```

## Environment Variables

Create a `.env.local` file (or `.env`) with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Optional: Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Optional: Error Monitoring (Sentry)
SENTRY_DSN=your_sentry_dsn
```

See `.env.example` for all available environment variables.

## API Authentication Middleware

Authentication middleware is located in:
- `lib/auth/api-middleware.ts`

**Functions:**
- `getAuthUser(request)` - Get authenticated user from request
- `requireAuth(request)` - Require authentication
- `requireRole(request, roles)` - Require specific role(s)

**Usage:**
```typescript
import { requireAuth, requireRole } from '@/lib/auth/api-middleware'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) {
    return authResult // Unauthorized
  }
  
  const { user } = authResult
  // Use user.id, user.email, user.role
}
```

## Rate Limiting

Rate limiting is implemented in `lib/middleware/rate-limit.ts`.

**Presets:**
- `api`: 100 requests/minute
- `auth`: 5 requests/minute
- `public`: 200 requests/minute
- `admin`: 500 requests/minute

**Usage:**
```typescript
import { rateLimit, getClientIdentifier } from '@/lib/middleware/rate-limit'

const identifier = getClientIdentifier(request)
const result = await rateLimit(identifier, 'api')

if (!result.success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  )
}
```

## CORS Configuration

CORS is configured in:
- `lib/middleware/cors.ts`
- `next.config.mjs` (static headers)

**Usage:**
```typescript
import { applyCorsHeaders } from '@/lib/middleware/cors'

const response = NextResponse.json({ data: 'success' })
return applyCorsHeaders(request, response)
```

## Error Logging and Monitoring

Error logging is implemented in `lib/utils/logger.ts`.

**Usage:**
```typescript
import { logger, handleApiError, AppError } from '@/lib/utils/logger'

try {
  // Your code
} catch (error) {
  logger.error('Operation failed', error, { context: 'additional info' })
  
  // Or use helper
  const errorResponse = handleApiError(error, { path: '/api/endpoint' })
  return NextResponse.json(
    { error: errorResponse.message },
    { status: errorResponse.statusCode }
  )
}
```

## API Route Wrapper

Use the `withApiMiddleware` wrapper for complete middleware integration:

```typescript
import { withApiMiddleware, apiResponse } from '@/lib/middleware/api-wrapper'

export const GET = withApiMiddleware(
  async (request, { user }) => {
    // Your handler code
    return apiResponse({ data: 'success' })
  },
  {
    requireAuth: true,
    requireRole: ['admin', 'customer'],
    rateLimit: 'api',
    methods: ['GET'],
    cors: true,
  }
)
```

## Database Migrations

To apply migrations:

```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase dashboard
# Copy contents of supabase/migrations/001_initial_schema.sql
```

## Next Steps

1. Set up Supabase project and configure environment variables
2. Run database migrations
3. Update API routes to use the new middleware
4. Configure rate limiting (Upstash Redis) for production
5. Set up error monitoring (Sentry) for production

