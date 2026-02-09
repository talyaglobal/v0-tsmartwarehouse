# Resend E-posta Kurulumu (info@warebnb.co)

Bu dokümanda Resend ile e-posta gönderimi ve **gönderici adresini (info@warebnb.co) nerede tanımlayacağınız** adım adım anlatılmaktadır.

---

## 1. Resend nasıl çalışır?

- **API Key**: `.env.local` içinde `RESEND_API_KEY` ile tanımlı. Resend’e “bu uygulama benim” demiş oluyorsunuz.
- **Gönderici adresi**: Uygulama içinde **tanımlamazsınız**; sadece **Resend dashboard’da domain ekleyip doğruladıktan sonra** o domain’deki herhangi bir adresi (örn. `info@warebnb.co`) kodda veya env’de kullanırsınız.
- Yani: Mail adresi “Resend’de bir yere yazıp kaydetmek” değil, **domain’i doğrulamak**; uygulama tarafında ise sadece `from: 'info@warebnb.co'` (veya env’deki `RESEND_FROM_EMAIL`) kullanmak.

---

## 2. Mail adresini nerede tanımlarsınız?

**Kısa cevap:** Resend’de adres ayrıca “tanımlanmaz”. Önce **domain’i** tanımlayıp doğrularsınız, sonra o domain’deki istediğiniz adresi (`info@warebnb.co`) kullanırsınız.

### Adım 1: Resend Dashboard’a girin

1. https://resend.com adresine gidin.
2. Giriş yapın (API key’i oluşturduğunuz hesap).

### Adım 2: Domain ekleyin (mail adresinin “nereden” gönderileceği)

1. Sol menüden **Domains** (veya **Settings → Domains**) bölümüne girin.
2. **Add Domain** / **Add Domain** butonuna tıklayın.
3. Domain olarak **warebnb.co** yazın (www veya alt alan adı olmadan).
4. Kaydedin.

### Adım 3: Domain’i doğrulayın (DNS)

1. Resend, size **DNS kayıtları** gösterecek (TXT, MX, CNAME vb.).
2. **warebnb.co**’nun DNS yönetimine gidin (domain’i aldığınız yerde: GoDaddy, Cloudflare, Namecheap vb.).
3. Resend’in verdiği kayıtları **aynen** ekleyin.
4. Kayıtlar yayıldıktan sonra (birkaç dakika – 48 saate kadar sürebilir) Resend dashboard’da **Verify** veya **Check DNS** deyin.
5. Durum **Verified** olana kadar `info@warebnb.co` ile gönderim **çalışmaz**.

### Adım 4: Uygulamada gönderici adresi

- Zaten **.env.local** içinde tanımlı:
  - `RESEND_FROM_EMAIL=info@warebnb.co`
- Uygulama tüm Resend e-postalarını bu adresten gönderir. **Ekstra bir yerde “mail adresi tanımlama” yok**; sadece domain doğrulandıktan sonra bu env değişkeni kullanılır.

---

## 3. Domain henüz doğrulanmadıysa (test)

- `info@warebnb.co` ile gönderim, domain doğrulana kadar **hata verir**.
- Test için `.env.local` içinde geçici olarak:
  - `RESEND_FROM_EMAIL=onboarding@resend.dev`
- Bu adres Resend’in ücretsiz test adresidir; sadece kendi hesabınızdaki e-postalara gönderebilirsiniz (Resend dashboard’da görünür).
- Domain doğrulandıktan sonra tekrar:
  - `RESEND_FROM_EMAIL=info@warebnb.co`
  yapmanız yeterli.

---

## 4. Özet: Sizin yapacaklarınız

| Ne yapacaksınız? | Nerede? |
|------------------|--------|
| API key’i eklemek | ✅ Yapıldı (`.env.local` → `RESEND_API_KEY`) |
| Gönderici adresi (info@warebnb.co) | ✅ Yapıldı (`.env.local` → `RESEND_FROM_EMAIL`) |
| **Domain eklemek** | Resend Dashboard → **Domains** → Add Domain → **warebnb.co** |
| **Domain doğrulamak** | Domain sağlayıcınızda DNS kayıtlarını ekleyip Resend’de Verify |
| Mail adresini “bir yere yazmak” | Gerek yok; domain doğru = info@warebnb.co kullanılabilir |

---

## 5. Projede Resend kullanılan yerler

- **Fatura e-postası**: Admin → Estimates → Create invoice → “Send PDF by email” seçildiğinde `lib/email/resend-invoice.ts` ile gönderilir.
- Tüm gönderimler `RESEND_API_KEY` ve `RESEND_FROM_EMAIL` ile yapılır.

---

---

## 6. Durum

- **Domain (warebnb.co)**: Resend’de doğrulama tamamlandı.
- **Gönderici adresi**: `info@warebnb.co` kullanıma hazır (`RESEND_FROM_EMAIL` ile).

---

**Son güncelleme:** Şubat 2026
