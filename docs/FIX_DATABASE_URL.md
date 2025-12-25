# DATABASE_URL Düzeltme - Hızlı Rehber

## Sorun
`getaddrinfo ENOTFOUND db.gyodzimmhtecocscyeip.supabase.co` hatası alıyorsunuz.

## Çözüm: Supabase Dashboard'dan Doğru Connection String'i Alın

### Adım 1: Supabase Dashboard'a Gidin
1. Tarayıcınızda şu adrese gidin: **https://app.supabase.com/project/gyodzimmhtecocscyeip**
2. Giriş yapın

### Adım 2: Database Settings
1. Sol menüden **Settings** (⚙️) tıklayın
2. **Database** sekmesine tıklayın

### Adım 3: Connection String'i Bulun ve Kopyalayın
Database sayfasında şunları arayın:

#### ✅ "Connection string" veya "URI" başlığı
- Bu bölümde bir connection string göreceksiniz
- Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
- **"Copy"** butonuna tıklayın veya metni seçip kopyalayın

#### Alternatif: "Connection info" veya "Database URL"
- Bazen farklı isimlerle de olabilir
- Aynı formatta bir string arayın

### Adım 4: .env.local Dosyasını Güncelleyin

**Yöntem 1: Otomatik (Önerilen)**
```bash
node scripts/update-database-url.js "BURAYA_KOPYALADIGINIZ_CONNECTION_STRING"
```

**Yöntem 2: Manuel**
1. `.env.local` dosyasını açın
2. `DATABASE_URL=` satırını bulun
3. Kopyaladığınız connection string ile değiştirin

### Adım 5: Test Edin
```bash
node scripts/test-database-connection.js
```

## Örnek Connection String Formatları

### Doğru Format 1 (Direct Connection)
```
postgresql://postgres:[PASSWORD]@db.gyodzimmhtecocscyeip.supabase.co:5432/postgres
```

### Doğru Format 2 (Connection Pooling - eğer varsa)
```
postgresql://postgres.gyodzimmhtecocscyeip:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

## Önemli Notlar

1. **Password'u değiştirmeyin**: Connection string'in içinde zaten doğru password var
2. **Tüm string'i kopyalayın**: Sadece password değil, tüm connection string'i kopyalayın
3. **Özel karakterler**: Eğer password'da özel karakterler varsa, bunlar URL encode edilmiş olabilir (%40, %23 gibi)

## Hala Çalışmıyorsa

1. **Supabase projesinin aktif olduğundan emin olun**
   - Dashboard'da projenin durumunu kontrol edin
   - Paused (duraklatılmış) olabilir

2. **Network bağlantınızı kontrol edin**
   - İnternet bağlantınızın çalıştığından emin olun
   - Firewall ayarlarını kontrol edin

3. **Farklı bir connection string formatı deneyin**
   - Eğer "Connection pooling" seçeneği varsa onu deneyin
   - Veya direct connection string'i deneyin

