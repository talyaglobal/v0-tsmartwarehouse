# API Client Migration Guide

Bu dokümantasyon, uygulamadaki tüm `fetch` çağrılarını yeni `api` client'ı ile değiştirmek için bir rehberdir.

## API Client Kullanımı

Yeni API client otomatik olarak toast bildirimleri gösterir:
- ✅ Başarılı istekler: Yeşil toast
- ❌ Hatalı istekler: Kırmızı toast

### Temel Kullanım

```typescript
import { api } from "@/lib/api/client"

// GET isteği
const result = await api.get('/api/v1/bookings')
if (result.success) {
  // result.data kullan
}

// POST isteği
const result = await api.post('/api/v1/claims', {
  bookingId: '...',
  type: '...',
})

// PUT isteği
const result = await api.put('/api/v1/bookings/123', {
  status: 'active'
})

// DELETE isteği
const result = await api.delete('/api/v1/bookings/123')

// PATCH isteği
const result = await api.patch('/api/v1/bookings/123', {
  notes: 'Updated notes'
})
```

### Özel Mesajlar

```typescript
// Özel başarı mesajı
const result = await api.post('/api/v1/claims', data, {
  successMessage: 'Claim başarıyla oluşturuldu',
  errorMessage: 'Claim oluşturulamadı',
})

// Toast gösterme (sessiz istekler için)
const result = await api.get('/api/v1/bookings', {
  showToast: false
})
```

### FormData Desteği

```typescript
// FormData otomatik olarak desteklenir
const formData = new FormData()
formData.append('file', file)
const result = await api.post('/api/v1/files/upload', formData)
```

## Migration Adımları

### 1. Import Ekle

```typescript
import { api } from "@/lib/api/client"
```

### 2. fetch() Çağrılarını Değiştir

**Önce:**
```typescript
const response = await fetch('/api/v1/bookings')
const data = await response.json()
if (response.ok) {
  setBookings(data.data)
}
```

**Sonra:**
```typescript
const result = await api.get('/api/v1/bookings', { showToast: false })
if (result.success) {
  setBookings(result.data || [])
}
```

### 3. POST/PUT/PATCH İstekleri

**Önce:**
```typescript
const response = await fetch('/api/v1/claims', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})
const result = await response.json()
```

**Sonra:**
```typescript
const result = await api.post('/api/v1/claims', data, {
  successMessage: 'Claim oluşturuldu',
})
```

## Güncellenmesi Gereken Dosyalar

Aşağıdaki dosyalarda hala `fetch('/api/...')` kullanılıyor:

- `app/(dashboard)/dashboard/invoices/page.tsx`
- `app/(dashboard)/dashboard/claims/page.tsx`
- `app/(admin)/admin/page.tsx`
- `app/(admin)/admin/bookings/page.tsx`
- `app/(admin)/admin/invoices/page.tsx`
- `app/(admin)/admin/incidents/page.tsx`
- `app/(admin)/admin/customers/page.tsx`
- `app/(admin)/admin/workers/page.tsx`
- `app/(admin)/admin/analytics/page.tsx`
- `app/(worker)/worker/page.tsx`
- `app/(worker)/worker/profile/page.tsx`

## Notlar

- Tüm API çağrıları otomatik olarak toast gösterir
- `showToast: false` ile toast'u devre dışı bırakabilirsiniz (ör: sayfa yüklenirken)
- FormData otomatik olarak desteklenir
- Network hataları otomatik olarak yakalanır ve toast gösterilir

