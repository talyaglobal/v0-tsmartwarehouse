# Environment Variables Setup Guide

## Quick Setup

1. **Create `.env.local` file** in the project root:
   ```bash
   cp .env.example .env.local
   ```

2. **Get your Supabase credentials:**
   - Go to your Supabase project dashboard: https://app.supabase.com
   - Navigate to **Settings** → **API**
   - Copy the following values:

3. **Add to `.env.local`:**
   ```env
   # Required
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

   # Optional (recommended for production)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Verify setup:**
   ```bash
   npm run check-env
   ```

## Required Variables

### `NEXT_PUBLIC_SUPABASE_URL`
- **Where to find:** Supabase Dashboard → Settings → API → Project URL
- **Format:** `https://xxxxxxxxxxxxx.supabase.co`
- **Required:** Yes
- **Used for:** All Supabase client connections

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Where to find:** Supabase Dashboard → Settings → API → anon/public key
- **Format:** JWT token starting with `eyJ...`
- **Required:** Yes
- **Used for:** Client-side and server-side authenticated operations
- **Security:** Safe to expose in client-side code (has RLS protection)

## Optional Variables

### `SUPABASE_SERVICE_ROLE_KEY`
- **Where to find:** Supabase Dashboard → Settings → API → service_role key
- **Format:** JWT token starting with `eyJ...`
- **Required:** No (but recommended)
- **Used for:** Server-side admin operations that bypass RLS
- **Security:** ⚠️ **NEVER expose this in client-side code!** Keep it secret.

### `NEXT_PUBLIC_SITE_URL`
- **Format:** `http://localhost:3000` (development) or `https://yourdomain.com` (production)
- **Required:** No (defaults to `http://localhost:3000`)
- **Used for:** Email verification and password reset redirects

## Notification Service Variables

### Email Notifications

#### SendGrid (Recommended)
- **`EMAIL_PROVIDER`** - Set to `"sendgrid"` (default) or `"aws-ses"`
- **`SENDGRID_API_KEY`** - Your SendGrid API key
  - Get from: https://app.sendgrid.com/settings/api_keys
  - Required for email notifications
- **`SENDGRID_FROM_EMAIL`** - Sender email address (default: `notifications@tsmart.com`)
- **`SENDGRID_FROM_NAME`** - Sender name (default: `TSmart Warehouse`)

#### AWS SES (Alternative)
- **`EMAIL_PROVIDER`** - Set to `"aws-ses"`
- **`AWS_SES_REGION`** - AWS region (default: `us-east-1`)
- **`AWS_SES_ACCESS_KEY_ID`** - AWS access key ID
- **`AWS_SES_SECRET_ACCESS_KEY`** - AWS secret access key
- **`AWS_SES_FROM_EMAIL`** - Verified sender email address

### SMS Notifications (Twilio)
- **`TWILIO_ACCOUNT_SID`** - Twilio Account SID
  - Get from: https://console.twilio.com/
- **`TWILIO_AUTH_TOKEN`** - Twilio Auth Token
- **`TWILIO_PHONE_NUMBER`** - Twilio phone number (format: `+1234567890`)

### WhatsApp Notifications (Twilio)
- **`TWILIO_WHATSAPP_NUMBER`** - Twilio WhatsApp Business number or sandbox number
  - Format: `whatsapp:+1234567890` or use sandbox: `whatsapp:+14155238886`
- **`TWILIO_WHATSAPP_SANDBOX`** - Alternative: Twilio WhatsApp sandbox number for testing

### Push Notifications (Web Push)
- **`VAPID_PUBLIC_KEY`** - VAPID public key for web push
  - Generate using: `npx web-push generate-vapid-keys`
- **`VAPID_PRIVATE_KEY`** - VAPID private key (keep secret!)
- **`VAPID_SUBJECT`** - VAPID subject (email or URL, default: `mailto:notifications@tsmart.com`)

### Example `.env.local` with Notifications

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Email Notifications (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=notifications@tsmart.com
SENDGRID_FROM_NAME=TSmart Warehouse

# SMS Notifications (Twilio) - Optional
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# WhatsApp Notifications (Twilio) - Optional
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Push Notifications (Web Push) - Optional
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:notifications@tsmart.com
```

## Verification

Run the environment checker:
```bash
npm run check-env
```

Expected output when correctly configured:
```
✅ Present environment variables:
   NEXT_PUBLIC_SUPABASE_URL: https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJ...
   
✅ All required environment variables are set!
🚀 You can now run: npm run dev
```

## Troubleshooting

### "Missing NEXT_PUBLIC_SUPABASE_URL"
- Make sure you've created `.env.local` (not `.env`)
- Verify the file is in the project root directory
- Check for typos in the variable name
- Restart your development server after adding variables

### "Invalid API key" error
- Verify you copied the correct key (anon key, not service role key for client operations)
- Check for extra spaces or line breaks
- Make sure the key starts with `eyJ`

### Environment variables not loading
- Next.js only loads `.env.local` automatically
- Restart the dev server: `npm run dev`
- Clear Next.js cache: `rm -rf .next`

## Security Notes

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use `.env.example`** for documenting required variables
3. **Service Role Key** should only be used server-side
4. **Anon Key** is safe for client-side (protected by RLS)

## Next Steps

After setting up environment variables:

1. ✅ Run `npm run check-env` to verify
2. ✅ Run database migrations in Supabase SQL Editor
3. ✅ Configure email templates in Supabase Dashboard
4. ✅ Test authentication flows

See `README_AUTH.md` for detailed authentication setup instructions.

