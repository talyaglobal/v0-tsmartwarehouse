# Supabase Password Reset Email Template

Bu dosya, Supabase Dashboard'da kullanılacak password reset email template'ini içerir.

## Supabase Dashboard'da Ayarlama

1. Supabase Dashboard'a gidin: https://app.supabase.com
2. Projenizi seçin
3. **Authentication** > **Email Templates** bölümüne gidin
4. **Reset Password** template'ini seçin
5. Aşağıdaki HTML template'ini kullanın

## Email Template

```html
<h2>Reset Your Password</h2>

<p>Hello,</p>

<p>We received a request to reset your password for your tsmartWarehouse account.</p>

<p>Click the button below to reset your password. This link will expire in 24 hours.</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Reset Password
  </a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all; color: #6b7280; font-size: 14px;">{{ .ConfirmationURL }}</p>

<p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

<p>Best regards,<br>
The tsmartWarehouse Team</p>

<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
<p style="color: #9ca3af; font-size: 12px;">
  This is an automated message. Please do not reply to this email.
</p>
```

## Redirect URL Ayarları

1. **Authentication** > **URL Configuration** bölümüne gidin
2. **Redirect URLs** kısmına şu URL'leri ekleyin:
   - `http://localhost:3001/reset-password` (development)
   - `https://yourdomain.com/reset-password` (production)

## Email Subject

Subject line: `Reset Your tsmartWarehouse Password`

## Önemli Notlar

- Link 24 saat geçerlidir (Supabase default)
- Email sadece kayıtlı email adreslerine gönderilir (güvenlik için)
- Email gönderimi SMTP ayarlarınız (SendGrid) üzerinden yapılır

