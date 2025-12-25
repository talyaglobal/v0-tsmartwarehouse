# DATABASE_URL Bağlantı Hatası Düzeltme Rehberi

## Sorun
`getaddrinfo ENOTFOUND db.gyodzimmhtecocscyeip.supabase.co` hatası alıyorsunuz.

## Çözüm Adımları

### 1. Supabase Dashboard'dan Doğru Connection String'i Alın

1. **Supabase Dashboard'a gidin:**
   - https://app.supabase.com/project/gyodzimmhtecocscyeip

2. **Settings → Database bölümüne gidin:**
   - Sol menüden **Settings** (Ayarlar) tıklayın
   - **Database** sekmesine tıklayın

3. **Connection string'i kopyalayın:**
   - **Connection string** bölümünde birkaç seçenek göreceksiniz:
     - **URI** (Direct connection - port 5432)
     - **Connection pooling** (Session mode - port 6543) ⭐ **ÖNERİLEN**
     - **Connection pooling** (Transaction mode - port 5432)

4. **Connection pooling (Session mode) seçeneğini kullanın:**
   - Bu seçenek daha stabil ve performanslıdır
   - Format: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

### 2. .env.local Dosyasını Güncelleyin

`.env.local` dosyasındaki `DATABASE_URL` satırını yeni connection string ile değiştirin:

```env
DATABASE_URL=postgresql://postgres.gyodzimmhtecocscyeip:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Önemli:** `[PASSWORD]` ve `[REGION]` kısımlarını Supabase Dashboard'dan aldığınız gerçek değerlerle değiştirin.

### 3. Alternatif: Direct Connection Kullanın

Eğer connection pooling çalışmazsa, direct connection kullanabilirsiniz:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.gyodzimmhtecocscyeip.supabase.co:5432/postgres
```

### 4. Connection String Formatları

#### Direct Connection (Port 5432)
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

#### Connection Pooling - Session Mode (Port 6543) ⭐ ÖNERİLEN
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

#### Connection Pooling - Transaction Mode (Port 5432)
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

### 5. Test Edin

Connection string'i güncelledikten sonra test edin:

```bash
node scripts/auto-run-migration.js
```

veya

```bash
npm run db:migrate
```

## Sorun Giderme

### Hata: "getaddrinfo ENOTFOUND"
- Connection string formatını kontrol edin
- Supabase Dashboard'dan yeni bir connection string kopyalayın
- Password'un doğru olduğundan emin olun

### Hata: "password authentication failed"
- Password'u Supabase Dashboard'dan yeniden kopyalayın
- Özel karakterler varsa URL encode edilmiş olmalı

### Hata: "connection timeout"
- Network bağlantınızı kontrol edin
- Firewall ayarlarını kontrol edin
- Connection pooling kullanmayı deneyin

## Notlar

- **Connection pooling** önerilir çünkü:
  - Daha stabil bağlantılar sağlar
  - Connection limit sorunlarını önler
  - Daha iyi performans verir

- **Direct connection** sadece:
  - Migration çalıştırırken
  - Tek seferlik işlemler için
  - Kullanılabilir

