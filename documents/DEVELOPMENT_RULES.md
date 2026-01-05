# Temel Geliştirme Kuralları

Bu dosya, AI asistanının (Auto) geliştirme sırasında uyması gereken temel kuralları içerir.

## 📋 Genel Kurallar

### 1. Migration Yönetimi (ZORUNLU)

**Migration'lar AI asistanı tarafından OTOMATİK olarak push edilmelidir.**

- ✅ Migration dosyası oluşturulduğunda veya değiştirildiğinde **mutlaka** `npx supabase db push` veya `scripts/push-supabase.js` komutu çalıştırılmalıdır
- ✅ Migration hataları varsa, hatalar düzeltilmeli ve tekrar push edilmelidir
- ❌ Kullanıcıdan migration'ı manuel push etmesi istenmemelidir
- ❌ Migration dosyası oluşturup push edilmeden bırakılmamalıdır

**Migration Push Adımları:**
```bash
# Migration oluşturulduktan sonra otomatik olarak:
npx supabase db push
# veya
node scripts/push-supabase.js
```

### 2. Dokümantasyon Yönetimi

**Plan yapıldığında oluşturulan .md dosyaları SADECE `/documents` klasörüne eklenmelidir.**

- ✅ Tüm planlama ve dokümantasyon .md dosyaları `documents/` klasörüne kaydedilmelidir
- ✅ Kök dizinde .md dosyası oluşturulmamalıdır (README.md hariç - o zaten documents'te)
- ✅ Dokümantasyon dosyaları anlamlı isimlerle oluşturulmalıdır

**Dokümantasyon Dosya İsimlendirme:**
- Plan dosyaları: `PLAN_<konu>_<tarih>.md`
- Rapor dosyaları: `<konu>_REPORT_<tarih>.md`
- Dokümantasyon: `<konu>_GUIDE.md` veya `<konu>_DOCUMENTATION.md`

### 3. Dokümantasyon Okuma ve Referans

**Geliştirme yaparken `/documents` klasöründeki dosyalar mutlaka okunmalı ve referans olarak kullanılmalıdır.**

- ✅ Yeni bir feature geliştirilmeden önce `documents/` klasöründeki ilgili planlama dosyaları okunmalıdır
- ✅ Mevcut mimari, kurallar ve planlar dokümantasyondan öğrenilmelidir
- ✅ Geliştirme sırasında dokümantasyondaki kurallara uyulmalıdır

**Okunması Gereken Öncelikli Dosyalar:**
1. `SETUP_GUIDE.md` - Proje kurulum ve yapılandırma
2. `SUPABASE_MIGRATION_AUTOMATION.md` - Migration yönetimi kuralları
3. `PRISMA_SETUP.md` / `PRISMA_MIGRATION_PLAN.md` - Database yönetimi
4. İlgili planlama dosyaları (BOOKING_PAYMENT_SYSTEM.md, WAREHOUSE_SERVICES_PLAN.md, vb.)

### 4. Kod Standartları

- ✅ TypeScript strict mode kullanılmalıdır
- ✅ Server Components varsayılan olarak kullanılmalıdır
- ✅ Client Components sadece gerektiğinde kullanılmalıdır
- ✅ Mevcut kod pattern'lerine uyulmalıdır
- ✅ Error handling kapsamlı olmalıdır

### 5. Test ve Kalite

- ✅ Yeni feature'lar için test yazılmalıdır (mümkünse)
- ✅ Linter hataları düzeltilmelidir
- ✅ Type safety korunmalıdır

## 🔄 İş Akışı

### Yeni Feature Geliştirme

1. **Planlama**
   - `documents/` klasöründeki ilgili dokümantasyonları oku
   - Gerekirse yeni plan dosyası oluştur (`documents/PLAN_<konu>.md`)

2. **Database Değişiklikleri**
   - Migration dosyası oluştur (`supabase/migrations/`)
   - **Otomatik olarak migration'ı push et**
   - Hata varsa düzelt ve tekrar push et

3. **Kod Geliştirme**
   - Mevcut pattern'lere uy
   - Type safety'yi koru
   - Error handling ekle

4. **Dokümantasyon**
   - Önemli değişiklikler için dokümantasyon güncelle
   - Plan dosyalarını güncelle (varsa)

### Migration İş Akışı

```
1. Migration dosyası oluştur/düzenle
   ↓
2. Otomatik olarak `npx supabase db push` çalıştır
   ↓
3. Hata varsa → Düzelt → Tekrar push et
   ↓
4. Başarılı → Devam et
```

## ⚠️ Önemli Notlar

- **Migration'lar asla manuel push beklenmemeli, otomatik olarak yapılmalıdır**
- **Dokümantasyon dosyaları sadece `documents/` klasörüne kaydedilmelidir**
- **Geliştirme öncesi `documents/` klasöründeki ilgili dosyalar okunmalıdır**
- **Kod yazmadan önce mevcut pattern'leri anlamak için codebase search yapılmalıdır**

## 📚 İlgili Dosyalar

- `documents/SETUP_GUIDE.md` - Proje kurulum rehberi
- `documents/SUPABASE_MIGRATION_AUTOMATION.md` - Migration otomasyon detayları
- `documents/PRISMA_SETUP.md` - Prisma kurulum
- `documents/PRISMA_MIGRATION_PLAN.md` - Prisma migration planı
- `documents/README.md` - Proje genel dokümantasyonu

