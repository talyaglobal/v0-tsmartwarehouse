# Hızlı Başlangıç Rehberi

## Yeni Mimariyi Kullanma

### 1. Server Action Oluşturma

```tsx
// features/[feature]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { success, failure } from '@/lib/shared/result'

const schema = z.object({
  name: z.string().min(1),
})

export async function createItemAction(input: z.infer<typeof schema>) {
  const validated = schema.parse(input)
  // ... database operations
  revalidatePath('/items')
  return success(item)
}
```

### 2. Server Component ile Data Fetching

```tsx
// app/[route]/page.tsx
import { getItemsQuery } from '@/features/items/lib/queries'
import { Suspense } from 'react'

export default async function ItemsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ItemsList />
    </Suspense>
  )
}

async function ItemsList() {
  const items = await getItemsQuery({})
  return <ItemsListClient items={items} />
}
```

### 3. Client Component'te Server Action Kullanma

```tsx
'use client'

import { createItemAction } from '@/features/items/actions'
import { useUIStore } from '@/stores/ui.store'

export function CreateItemForm() {
  const addNotification = useUIStore((state) => state.addNotification)

  async function handleSubmit(data: FormData) {
    const result = await createItemAction({
      name: data.get('name') as string,
    })

    if (result.success) {
      addNotification({ type: 'success', message: 'Item created!' })
    } else {
      addNotification({ type: 'error', message: result.error })
    }
  }

  return <form action={handleSubmit}>...</form>
}
```

### 4. Zustand Store Kullanma

```tsx
'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'

export function MyComponent() {
  const { user, setUser } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { addNotification } = useUIStore()

  // ...
}
```

### 5. Error Boundary Kullanma

```tsx
import { ErrorBoundaryWrapper } from '@/components/error-boundary-wrapper'

export default function Layout({ children }) {
  return (
    <ErrorBoundaryWrapper>
      {children}
    </ErrorBoundaryWrapper>
  )
}
```

## Yaygın Pattern'ler

### Form Handling

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createItemAction } from '@/features/items/actions'

const schema = z.object({
  name: z.string().min(1),
})

export function ItemForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: z.infer<typeof schema>) {
    const result = await createItemAction(data)
    if (result.success) {
      form.reset()
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

### Loading States

```tsx
'use client'

import { useUIStore } from '@/stores/ui.store'

export function MyComponent() {
  const { setLoading, isLoading } = useUIStore()

  async function handleAction() {
    setLoading('my-action', true)
    try {
      // ... action
    } finally {
      setLoading('my-action', false)
    }
  }

  if (isLoading('my-action')) {
    return <Loading />
  }
}
```

### Notifications

```tsx
'use client'

import { useUIStore } from '@/stores/ui.store'

export function MyComponent() {
  const { addNotification } = useUIStore()

  function handleSuccess() {
    addNotification({
      type: 'success',
      message: 'Operation completed!',
      duration: 3000,
    })
  }
}
```

## Dosya Yapısı Kuralları

### Feature Oluşturma

```
features/
  └── [feature-name]/
      ├── actions.ts          # Server Actions
      ├── components/         # Feature components
      │   ├── [feature]-list.tsx
      │   └── [feature]-form.tsx
      ├── lib/
      │   └── queries.ts      # Server Component queries
      └── types.ts           # Feature types
```

### Naming Conventions

- **Server Actions**: `[action]Action` (örn: `createBookingAction`)
- **Queries**: `get[Entity]Query` (örn: `getBookingsQuery`)
- **Components**: PascalCase (örn: `BookingsList`)
- **Client Components**: `[Name]Client` (örn: `BookingsListClient`)

## Best Practices

1. ✅ Server Components varsayılan kullan
2. ✅ Client Components sadece gerektiğinde (`"use client"`)
3. ✅ Server Actions için Result type kullan
4. ✅ Zod validation her zaman
5. ✅ Suspense boundaries ekle
6. ✅ Error boundaries route seviyesinde
7. ✅ Type-safe her şey

## Yardımcı Kaynaklar

- `ARCHITECTURE.md` - Detaylı mimari açıklaması (bu klasörde)
- `MIGRATION_GUIDE.md` - Migration rehberi (bu klasörde)
- `MODERNIZATION_SUMMARY.md` - Yapılan değişiklikler (bu klasörde)

