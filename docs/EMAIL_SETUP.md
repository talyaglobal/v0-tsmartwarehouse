# Email Configuration Guide

## SMTP Configuration

To enable email sending (including invitation emails), you need to configure SMTP settings in your `.env.local` file.

### Required Environment Variables

Add the following variables to your `.env.local` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=TSmart Warehouse
```

### Gmail Setup

1. Enable 2-Step Verification on your Google Account
2. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "TSmart Warehouse" as the name
   - Copy the generated 16-character password
3. Use these settings:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   ```

### Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

### Testing Email Configuration

After setting up SMTP, test by sending an invitation. Check the server console logs for:
- `✅ SMTP connection verified successfully`
- `✅ Invitation email sent successfully`

If you see errors, check:
1. SMTP credentials are correct
2. Firewall allows SMTP connections
3. Port 587 or 465 is not blocked
4. For Gmail: App Password is used (not regular password)

### Troubleshooting

**Error: "SMTP configuration is missing"**
- Check that all required variables are set in `.env.local`
- Restart your development server after adding variables

**Error: "SMTP connection failed"**
- Verify SMTP_HOST and SMTP_PORT are correct
- Check if your network allows SMTP connections
- Try using SMTP_SECURE=true with port 465

**Error: "Authentication failed"**
- Verify SMTP_USER and SMTP_PASSWORD are correct
- For Gmail, ensure you're using an App Password, not your regular password
- Check if 2-Step Verification is enabled (required for App Passwords)

