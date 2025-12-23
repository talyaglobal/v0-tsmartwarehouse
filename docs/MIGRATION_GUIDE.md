# Migration Guide: Modern Enterprise Architecture

**Date:** December 21, 2025  
**Target:** Next.js 16+ Enterprise Patterns

---

## Overview

This guide outlines the migration from the current architecture to a modern, enterprise-grade structure following 2025 best practices.

## Key Changes

### 1. Feature-Based Architecture

**Before:**
```
lib/
  ├── db/
  │   ├── bookings.ts
  │   ├── tasks.ts
  │   └── ...
  components/
    ├── admin/
    └── dashboard/
```

**After:**
```
features/
  ├── bookings/
  │   ├── actions.ts          # Server Actions
  │   ├── components/         # Feature components
  │   ├── lib/                # Feature utilities
  │   └── types.ts            # Feature types
  ├── tasks/
  └── invoices/
```

### 2. Server Actions Instead of API Routes

**Before:**
```tsx
// app/api/v1/bookings/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json()
  // ... validation and logic
  return NextResponse.json({ success: true, data: booking })
}

// Client component
const response = await fetch('/api/v1/bookings', {
  method: 'POST',
  body: JSON.stringify(data),
})
```

**After:**
```tsx
// features/bookings/actions.ts
'use server'
export async function createBookingAction(input: BookingInput) {
  // ... validation and logic
  revalidatePath('/dashboard/bookings')
  return success(booking)
}

// Client component
import { createBookingAction } from '@/features/bookings/actions'
const result = await createBookingAction(data)
if (result.success) {
  // Handle success
}
```

### 3. Server Components First

**Before:**
```tsx
"use client"
export default function BookingsPage() {
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    fetch('/api/v1/bookings').then(res => res.json())
      .then(data => setBookings(data.data))
  }, [])
  return <BookingsList bookings={bookings} />
}
```

**After:**
```tsx
// Server Component (default)
import { getBookingsQuery } from '@/features/bookings/lib/queries'

export default async function BookingsPage() {
  const bookings = await getBookingsQuery({})
  return <BookingsList bookings={bookings} />
}
```

### 4. State Management with Zustand

**Before:**
```tsx
// Using React Context or prop drilling
const [user, setUser] = useState(null)
```

**After:**
```tsx
// Using Zustand store
import { useAuthStore } from '@/stores/auth.store'

const { user, setUser } = useAuthStore()
```

### 5. Type-Safe Error Handling

**Before:**
```tsx
try {
  const data = await someAction()
  // Handle success
} catch (error) {
  // Handle error (unknown type)
}
```

**After:**
```tsx
import { success, failure, type Result } from '@/lib/shared/result'

const result = await someAction()
if (result.success) {
  // TypeScript knows result.data exists
  console.log(result.data)
} else {
  // TypeScript knows result.error exists
  console.error(result.error)
}
```

## Migration Steps

### Phase 1: Foundation ✅

1. ✅ Create feature-based folder structure
2. ✅ Add Zustand stores
3. ✅ Create Server Actions infrastructure
4. ✅ Add Result type pattern
5. ✅ Update TypeScript configuration

### Phase 2: Migrate Features (In Progress)

For each feature (bookings, tasks, invoices, etc.):

1. **Create feature folder**
   ```bash
   mkdir -p features/bookings/{actions,components,lib}
   ```

2. **Move Server Actions**
   - Create `features/[feature]/actions.ts`
   - Move logic from API routes
   - Add Result type returns

3. **Create Server Component queries**
   - Create `features/[feature]/lib/queries.ts`
   - Use React `cache()` for deduplication

4. **Update components**
   - Convert to Server Components where possible
   - Split into Server + Client components
   - Add Suspense boundaries

5. **Update API routes (temporary)**
   - Keep API routes for external integrations
   - Mark as deprecated
   - Add migration comments

### Phase 3: Cleanup

1. Remove deprecated API routes
2. Update all imports
3. Update documentation
4. Run full test suite

## Examples

### Example 1: Creating a Booking

**Old Way:**
```tsx
// Client Component
const handleSubmit = async (data) => {
  const response = await fetch('/api/v1/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const result = await response.json()
  if (result.success) {
    router.push('/dashboard/bookings')
  }
}
```

**New Way:**
```tsx
// Client Component
import { createBookingAction } from '@/features/bookings/actions'

const handleSubmit = async (data) => {
  const result = await createBookingAction(data)
  if (result.success) {
    router.push('/dashboard/bookings')
    addNotification({ type: 'success', message: 'Booking created!' })
  } else {
    addNotification({ type: 'error', message: result.error })
  }
}
```

### Example 2: Fetching Bookings

**Old Way:**
```tsx
"use client"
export default function BookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/bookings')
      .then(res => res.json())
      .then(data => {
        setBookings(data.data)
        setLoading(false)
      })
  }, [])

  if (loading) return <Loading />
  return <BookingsList bookings={bookings} />
}
```

**New Way:**
```tsx
// Server Component
import { Suspense } from 'react'
import { getBookingsQuery } from '@/features/bookings/lib/queries'
import { BookingsList } from '@/features/bookings/components/bookings-list'
import { DefaultLoadingFallback } from '@/lib/server/suspense-boundary'

export default async function BookingsPage() {
  return (
    <Suspense fallback={<DefaultLoadingFallback />}>
      <BookingsListAsync />
    </Suspense>
  )
}

async function BookingsListAsync() {
  const bookings = await getBookingsQuery({})
  return <BookingsList bookings={bookings} />
}
```

## Benefits

### 1. Performance
- ✅ Reduced client bundle size
- ✅ Faster initial page loads
- ✅ Better caching strategies
- ✅ Streaming support

### 2. Developer Experience
- ✅ Better TypeScript inference
- ✅ Type-safe error handling
- ✅ Clearer code organization
- ✅ Easier testing

### 3. Maintainability
- ✅ Feature isolation
- ✅ Clear boundaries
- ✅ Easier to scale
- ✅ Better code reuse

### 4. User Experience
- ✅ Faster page loads
- ✅ Better error handling
- ✅ Optimistic updates
- ✅ Progressive enhancement

## Testing Strategy

### Server Actions
```tsx
import { createBookingAction } from '@/features/bookings/actions'

test('creates booking successfully', async () => {
  const result = await createBookingAction(validData)
  expect(result.success).toBe(true)
  expect(result.data).toHaveProperty('id')
})

test('validates input', async () => {
  const result = await createBookingAction(invalidData)
  expect(result.success).toBe(false)
  expect(result.error).toBeDefined()
})
```

### Server Components
```tsx
import { render } from '@testing-library/react'
import BookingsPage from '@/app/(dashboard)/dashboard/bookings/page'

test('renders bookings', async () => {
  const { container } = await render(await BookingsPage())
  expect(container).toHaveTextContent('Bookings')
})
```

## Rollout Plan

1. **Week 1**: Foundation (✅ Complete)
2. **Week 2**: Migrate bookings feature
3. **Week 3**: Migrate tasks feature
4. **Week 4**: Migrate invoices feature
5. **Week 5**: Cleanup and optimization

## Resources

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

