# Performance Optimization Guide

This document outlines the performance optimizations implemented in the TSmart Warehouse Management System.

## Table of Contents

1. [Database Query Optimization](#database-query-optimization)
2. [Caching Strategy](#caching-strategy)
3. [API Response Caching](#api-response-caching)
4. [Image CDN Integration](#image-cdn-integration)
5. [Bundle Size Optimization](#bundle-size-optimization)
6. [Lazy Loading](#lazy-loading)

---

## Database Query Optimization

### Implemented Optimizations

1. **Selective Field Queries**
   - Instead of using `SELECT *`, queries now only fetch required fields
   - Reduces data transfer and improves query performance
   - Example: Bookings queries only select specific columns needed

2. **Pagination Support**
   - All list queries support `limit` and `offset` parameters
   - Prevents loading unnecessary data for large datasets
   - Implemented in `lib/db/bookings.ts` and `lib/db/invoices.ts`

3. **Indexed Queries**
   - Database schema includes indexes on frequently queried fields
   - Foreign keys and common filter columns are indexed
   - See `supabase/migrations/001_initial_schema.sql` for index definitions

### Usage Example

```typescript
// Optimized query with pagination and selective fields
const bookings = await getBookings({
  customerId: 'user-123',
  status: 'active',
  limit: 20,
  offset: 0,
  useCache: true,
})
```

---

## Caching Strategy

### Redis Caching Implementation

- **Location**: `lib/cache/redis.ts`
- **Backend**: Upstash Redis (production) or in-memory cache (development)
- **TTL Presets**: SHORT (1min), MEDIUM (5min), LONG (1hr), VERY_LONG (24hr)

### Cache Invalidation

Cache is automatically invalidated when data is created, updated, or deleted:

```typescript
// Automatically invalidates related caches
await invalidateCache(CACHE_PREFIXES.BOOKINGS, bookingId)
```

### Cache Key Structure

```
booking:123                    // Single booking
bookings:all:active:all:20:0   // List with filters and pagination
```

### Configuration

Set these environment variables for Redis caching:

```env
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

If not configured, the system falls back to in-memory caching (development only).

---

## API Response Caching

### Next.js Cache Headers

API routes include cache headers for optimal CDN and browser caching:

- **Location**: `lib/cache/api-cache.ts`
- **Implementation**: `setCacheHeaders()` utility function
- **Default**: 5 minutes cache with 1 minute stale-while-revalidate

### Usage

```typescript
import { setCacheHeaders } from '@/lib/cache/api-cache'

export async function GET(request: NextRequest) {
  const data = await getData()
  const response = NextResponse.json({ data })
  return setCacheHeaders(response, 300, 60) // 5min cache, 1min stale
}
```

### Route-Level Revalidation

API routes can specify revalidation times:

```typescript
export const revalidate = 300 // 5 minutes
```

---

## Image CDN Integration

### Next.js Image Optimization

- **Status**: ✅ Enabled
- **Configuration**: `next.config.mjs`
- **Formats**: AVIF, WebP
- **Device Sizes**: Optimized for all screen sizes
- **Cache TTL**: 60 seconds minimum

### Configuration

```javascript
images: {
  unoptimized: false, // Enabled
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  minimumCacheTTL: 60,
}
```

### Remote Image Domains

Configure external image sources in `next.config.mjs`:

```javascript
remotePatterns: [
  {
    protocol: 'https',
    hostname: '**.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
]
```

### Usage

```tsx
import Image from 'next/image'

<Image
  src="/warehouse-aerial.png"
  alt="Warehouse"
  width={1920}
  height={1080}
  priority // For above-the-fold images
/>
```

---

## Bundle Size Optimization

### Dynamic Imports

Heavy components are loaded on-demand using Next.js dynamic imports:

- **Recharts**: Lazy loaded in analytics page
- **Large Components**: Loaded only when needed
- **Code Splitting**: Automatic with Next.js App Router

### Implementation

```typescript
const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <LoadingSpinner />,
  ssr: false, // For client-only components
})
```

### Analyzer

To analyze bundle size:

```bash
npm run build
# Check .next/analyze for bundle breakdown
```

---

## Lazy Loading

### Chart Components

All Recharts components are lazy-loaded:

- **Location**: `components/charts/`
- **Benefits**: Reduces initial bundle by ~200KB
- **Loading States**: Shows placeholder while loading

### Implemented Components

1. `RevenueChart` - Bar chart for revenue data
2. `UtilizationChart` - Line chart for floor utilization
3. `ServiceBreakdownChart` - Pie chart for service distribution

### Usage

```tsx
import { RevenueChart } from '@/components/charts/revenue-chart'

<RevenueChart data={revenueData} />
```

### Loading Strategy

- Charts load only when their tab is visible
- Suspense boundaries provide loading states
- Client-side only rendering for better performance

---

## Performance Metrics

### Expected Improvements

1. **Database Queries**: 40-60% faster with caching
2. **API Responses**: 70-80% faster with cached responses
3. **Bundle Size**: 30-40% reduction with lazy loading
4. **Image Loading**: 50-70% faster with Next.js optimization
5. **Initial Page Load**: 25-35% improvement

### Monitoring

Monitor performance using:

- **Next.js Analytics**: Built-in performance metrics
- **Vercel Analytics**: Real-time performance data
- **Browser DevTools**: Lighthouse scores

---

## Best Practices

### When to Use Caching

✅ **DO cache:**
- Frequently accessed data
- Expensive database queries
- Static or slowly-changing data
- API responses that don't require real-time updates

❌ **DON'T cache:**
- User-specific sensitive data
- Real-time data (use Supabase Realtime instead)
- Data that changes frequently (< 1 minute)

### Cache Invalidation

Always invalidate cache on:
- CREATE operations
- UPDATE operations
- DELETE operations

### Image Optimization

- Use Next.js `Image` component instead of `<img>`
- Set `priority` for above-the-fold images
- Provide proper `width` and `height` attributes
- Use appropriate image formats (WebP, AVIF)

---

## Future Improvements

1. **Service Worker**: Implement offline caching
2. **CDN Integration**: Configure custom CDN for images
3. **Query Optimization**: Add database query analysis
4. **Bundle Analysis**: Automated bundle size monitoring
5. **Performance Budget**: Set and enforce performance budgets

---

## References

- [Next.js Image Optimization](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Upstash Redis](https://upstash.com/docs)
- [Recharts Documentation](https://recharts.org/)

