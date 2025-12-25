# Supabase Dashboard'da Connection String Bulma

## Connection String Nerede?

Supabase Dashboard'da connection string'ler genellikle şu yerlerde bulunur:

### 1. Settings → Database Sayfasının ÜST KISMI
- Sayfanın en üstünde **"Connection string"** veya **"Connection info"** başlığı
- Veya **"Database URL"** başlığı
- Burada 3 farklı format görebilirsiniz:
  - **Direct connection** (port 5432)
  - **Session mode** (port 6543) ⭐ ÖNERİLEN
  - **Transaction mode** (port 5432)

### 2. Connection String Formatları

Eğer bulursanız, şu formatta olmalı:

#### Direct Connection
```
postgresql://postgres:[PASSWORD]@db.gyodzimmhtecocscyeip.supabase.co:5432/postgres
```

#### Session Mode (Connection Pooling) ⭐ ÖNERİLEN
```
postgresql://postgres.gyodzimmhtecocscyeip:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### 3. Eğer Connection String Görmüyorsanız

1. **Sayfayı yukarı kaydırın** - Connection string'ler genellikle sayfanın üst kısmında
2. **Farklı bir sekme olabilir** - "Connection info", "Database URL" gibi
3. **Settings → API** sayfasına bakın - Bazen orada da olabilir

## IPv4/IPv6 Sorunu

Ekranda "Dedicated Pooler is not IPv4 compatible" uyarısı görüyorsunuz. Bu, network'ünüzün sadece IPv4 destekliyorsa sorun olabilir.

**Çözüm:**
- **Session mode** connection string kullanın (port 6543)
- Bu genellikle IPv4 uyumludur

## Hızlı Test

Connection string'i bulduktan sonra:

```bash
node scripts/update-database-url.js "BURAYA_CONNECTION_STRING"
node scripts/test-database-connection.js
```

