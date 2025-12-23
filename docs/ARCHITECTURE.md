# TSmart Warehouse - Enterprise Architecture

**Last Updated:** December 21, 2025  
**Next.js Version:** 16.0.7  
**Architecture Pattern:** Feature-Based (Domain-Driven Design)

---

## Architecture Overview

This application follows modern enterprise development practices with a feature-based architecture, leveraging Next.js 16+ capabilities including Server Components, Server Actions, and advanced caching strategies.

## Folder Structure

```
tsmart-warehouse/
├── app/                          # Next.js App Router
│   ├── (admin)/                  # Admin route group
│   ├── (auth)/                   # Authentication route group
│   ├── (dashboard)/              # Customer dashboard route group
│   ├── (worker)/                 # Worker route group
│   ├── api/                      # API routes (legacy, migrating to Server Actions)
│   └── [feature]/                # Feature-based routes
│
├── features/                     # Feature-based modules (NEW)
│   ├── bookings/
│   │   ├── components/           # Feature-specific components
│   │   ├── actions/              # Server Actions
│   │   ├── hooks/                # Custom hooks
│   │   ├── lib/                  # Feature-specific utilities
│   │   └── types.ts              # Feature types
│   ├── tasks/
│   ├── invoices/
│   └── ...
│
├── components/                    # Shared UI components
│   ├── ui/                       # shadcn/ui components
│   └── [shared]/                 # Shared business components
│
├── lib/                          # Core libraries
│   ├── server/                   # Server-only utilities
│   ├── client/                   # Client-only utilities
│   ├── shared/                   # Shared utilities
│   └── config/                   # Configuration
│
├── stores/                       # State management (Zustand)
│   ├── auth.store.ts
│   ├── ui.store.ts
│   └── [feature].store.ts
│
├── types/                        # Global TypeScript types
└── public/                       # Static assets
```

## Key Architectural Patterns

### 1. Server Components (Default)
- All components are Server Components by default
- Use `"use client"` only when necessary (interactivity, hooks, browser APIs)
- Fetch data directly in Server Components

### 2. Server Actions
- Replace API routes for mutations and form submissions
- Located in `features/[feature]/actions/`
- Use `'use server'` directive
- Type-safe with Zod validation

### 3. Feature-Based Organization
- Each feature is self-contained
- Features can be easily extracted to microservices
- Clear boundaries and dependencies

### 4. State Management
- **Server State**: React Server Components + Server Actions
- **Client State**: Zustand stores for UI state
- **Form State**: React Hook Form + Zod

### 5. Data Fetching
- **Server Components**: Direct database queries
- **Client Components**: Server Actions or API routes (legacy)
- **Caching**: Next.js cache, React cache, unstable_cache

### 6. Error Handling
- Error boundaries at route level
- Server Actions return Result types
- Consistent error responses

## Technology Stack

### Core
- **Framework**: Next.js 16.0.7 (App Router)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI + shadcn/ui

### State Management
- **Server State**: React Server Components
- **Client State**: Zustand
- **Form State**: React Hook Form + Zod

### Database & Auth
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage

### Development
- **Testing**: Jest, Playwright
- **Linting**: ESLint
- **Formatting**: Prettier
- **Type Checking**: TypeScript strict mode

## Best Practices

### 1. Server Components First
```tsx
// ✅ Good: Server Component
export default async function BookingsPage() {
  const bookings = await getBookings()
  return <BookingsList bookings={bookings} />
}

// ❌ Avoid: Unnecessary Client Component
"use client"
export default function BookingsPage() {
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    fetch('/api/v1/bookings').then(...)
  }, [])
  return <BookingsList bookings={bookings} />
}
```

### 2. Server Actions for Mutations
```tsx
// ✅ Good: Server Action
'use server'
export async function createBooking(data: BookingData) {
  // Validation, database operations
  revalidatePath('/dashboard/bookings')
  return { success: true, data: booking }
}

// ❌ Avoid: API route for simple mutations
// app/api/v1/bookings/route.ts
```

### 3. Feature Isolation
```tsx
// ✅ Good: Feature-based structure
features/bookings/
  ├── components/
  ├── actions/
  └── types.ts

// ❌ Avoid: Everything in lib/
lib/
  ├── bookings.ts
  ├── tasks.ts
  └── ...
```

### 4. Type Safety
```tsx
// ✅ Good: Zod schemas for validation
const bookingSchema = z.object({
  type: z.enum(['pallet', 'area-rental']),
  palletCount: z.number().positive().optional(),
})

// ✅ Good: Type inference
type Booking = z.infer<typeof bookingSchema>
```

## Migration Strategy

### Phase 1: Foundation ✅
- [x] Feature-based folder structure
- [x] Server Actions setup
- [x] Zustand stores
- [x] Type improvements

### Phase 2: Migration (In Progress)
- [ ] Convert API routes to Server Actions
- [ ] Migrate Client Components to Server Components where possible
- [ ] Implement Suspense boundaries
- [ ] Add streaming for data fetching

### Phase 3: Optimization
- [ ] Implement ISR for static content
- [ ] Add edge runtime where appropriate
- [ ] Optimize bundle size
- [ ] Performance monitoring

## Performance Considerations

1. **Caching Strategy**
   - Static: `cache: 'force-cache'`
   - Dynamic: `cache: 'no-store'`
   - Revalidation: `revalidate: 3600`

2. **Code Splitting**
   - Route-based splitting (automatic)
   - Component lazy loading for heavy components

3. **Image Optimization**
   - Next.js Image component
   - AVIF/WebP formats
   - Responsive sizes

4. **Bundle Size**
   - Tree shaking
   - Dynamic imports
   - Analyze bundle regularly

## Security

1. **Authentication**
   - Supabase Auth with JWT
   - Server-side session validation
   - Role-based access control

2. **Data Validation**
   - Zod schemas for all inputs
   - Server-side validation
   - SQL injection prevention (Supabase)

3. **CSRF Protection**
   - CSRF tokens for mutations
   - SameSite cookies

4. **Rate Limiting**
   - Upstash Redis for rate limiting
   - Per-route limits

## Monitoring & Observability

1. **Error Tracking**
   - Sentry integration
   - Error boundaries
   - Server Action error handling

2. **Analytics**
   - Vercel Analytics
   - Custom event tracking

3. **Performance**
   - Web Vitals
   - Server response times
   - Database query performance

