# Password Reset Debug Guide

## Kontrol Edilmesi Gerekenler

### 1. Supabase Dashboard Ayarları

#### SMTP Settings
1. Supabase Dashboard > Settings > Auth > SMTP Settings
2. Custom SMTP Provider seçili olmalı
3. Şu bilgiler girilmiş olmalı:
   - SMTP Host: `smtp.sendgrid.net`
   - SMTP Port: `587`
   - SMTP User: `apikey`
   - SMTP Password: `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`
   - Sender email: `noreply@tsmartwarehouse.com`
   - Sender name: `tsmartWarehouse`

#### Redirect URLs
1. Authentication > URL Configuration > Redirect URLs
2. Şu URL'ler eklenmiş olmalı:
   - `http://localhost:3001/reset-password`
   - Production URL'iniz (varsa)

#### Email Templates
1. Authentication > Email Templates > Reset Password
2. Template aktif olmalı ve güzel bir HTML template kullanılmalı

### 2. Environment Variables

`.env.local` dosyasında şunlar olmalı:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Console Logları

Password reset isteği gönderildiğinde terminal'de şu loglar görünmeli:
```
Sending password reset email to: [email]
Redirect URL: http://localhost:3001/reset-password
Password reset response: { data: ..., error: ... }
```

### 4. Supabase Logs

1. Supabase Dashboard > Logs > Auth Logs
2. Password reset isteği gönderildiğinde log'ları kontrol edin
3. Hata varsa burada görünecek

### 5. SendGrid Kontrolleri

1. SendGrid Dashboard'a gidin
2. Activity > Email Activity bölümüne bakın
3. Email gönderilmiş mi kontrol edin
4. Bounce veya block varsa nedenini kontrol edin

### 6. Email Kontrolleri

- Spam klasörünü kontrol edin
- Email adresinin Supabase'de kayıtlı olduğundan emin olun
- Email adresinin doğru yazıldığından emin olun

### 7. Test Adımları

1. `http://localhost:3001/forgot-password` sayfasına gidin
2. Kayıtlı bir email adresi girin
3. "Send Reset Link" butonuna tıklayın
4. Terminal'deki logları kontrol edin
5. Supabase Dashboard > Logs > Auth Logs'u kontrol edin
6. SendGrid Activity'yi kontrol edin
7. Email'inizi kontrol edin (inbox ve spam)

### 8. Yaygın Hatalar

#### "User not found"
- Email adresi Supabase'de kayıtlı değil
- Çözüm: Önce kayıt olun veya doğru email kullanın

#### "Rate limit exceeded"
- Çok fazla istek gönderilmiş
- Çözüm: Birkaç dakika bekleyin

#### "SMTP error"
- SMTP ayarları yanlış
- Çözüm: Supabase Dashboard'da SMTP ayarlarını kontrol edin

#### "Redirect URL not allowed"
- Redirect URL whitelist'te değil
- Çözüm: Supabase Dashboard'da Redirect URLs'e ekleyin

#### Email gelmiyor ama hata yok
- SMTP ayarları eksik veya yanlış
- SendGrid hesabı kısıtlanmış olabilir
- Email spam'a düşmüş olabilir
- Çözüm: Yukarıdaki tüm kontrolleri yapın

