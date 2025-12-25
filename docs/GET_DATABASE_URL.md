# DATABASE_URL Nasıl Alınır - Adım Adım

## Supabase Dashboard'dan Connection String Alma

### Adım 1: Supabase Dashboard'a Gidin
1. https://app.supabase.com/project/gyodzimmhtecocscyeip adresine gidin
2. Giriş yapın

### Adım 2: Database Settings'e Gidin
1. Sol menüden **Settings** (⚙️ Ayarlar) tıklayın
2. **Database** sekmesine tıklayın

### Adım 3: Connection String'i Bulun
Database sayfasında şu bölümleri göreceksiniz:

#### Seçenek 1: Connection string (URI) - ⭐ BUNU KULLANIN
- **"Connection string"** veya **"URI"** başlığı altında
- Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`
- **"Copy"** butonuna tıklayın

#### Seçenek 2: Connection pooling (eğer varsa)
- **"Connection pooling"** bölümünde
- **"Session mode"** veya **"Transaction mode"** seçenekleri
- Bunlar yoksa, **URI** formatını kullanın

### Adım 4: Connection String Formatı
Doğru format şöyle olmalı:
```
postgresql://postgres:[PASSWORD]@db.gyodzimmhtecocscyeip.supabase.co:5432/postgres
```

**Önemli:**
- `[PASSWORD]` kısmı Supabase Dashboard'dan kopyaladığınız gerçek password olmalı
- Password özel karakterler içeriyorsa, URL encode edilmiş olabilir
- Eğer password'da özel karakterler varsa (ör: `@`, `#`, `%`), bunlar `%40`, `%23`, `%25` gibi encode edilmiş olmalı

### Adım 5: Alternatif Yerler
Eğer Database settings'te bulamazsanız:

1. **Project Settings → Database → Connection string**
2. **Project Settings → API → Database URL** (bazen burada da olabilir)
3. **SQL Editor** sayfasında bazen connection bilgileri gösterilir

### Adım 6: Test
Connection string'i aldıktan sonra:
```bash
node scripts/update-database-url.js "BURAYA_COPY_PASTE_YAPIN"
```

## Sorun Giderme

### "Connection string bulamıyorum"
- Settings → Database sayfasında **"Connection string"** veya **"URI"** başlığını arayın
- Bazen **"Connection info"** veya **"Database URL"** olarak da adlandırılabilir

### "Password'u nasıl bulacağım?"
- Password, connection string'in içinde zaten var
- Sadece tüm connection string'i kopyalayın
- Ayrıca password'u bulmanıza gerek yok

### "Format doğru mu?"
- Connection string şu formatta olmalı: `postgresql://user:password@host:port/database`
- `postgresql://` ile başlamalı
- `@` işareti password ve host arasında olmalı
- Port genellikle `5432` olmalı

