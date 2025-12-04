# TSmart Warehouse Management System - Deployment Guide

**Version:** 1.0.0  
**Last Updated:** December 2024

This guide covers deploying the TSmart Warehouse Management System to production environments.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Platforms](#deployment-platforms)
  - [Vercel (Recommended)](#vercel-recommended)
  - [Netlify](#netlify)
  - [Self-Hosted](#self-hosted)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Storage Setup](#storage-setup)
- [Post-Deployment](#post-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

1. ✅ **Supabase Project** - Production database configured
2. ✅ **Environment Variables** - All required variables documented
3. ✅ **Domain Name** - (Optional) Custom domain for production
4. ✅ **SSL Certificate** - (Auto-configured on Vercel/Netlify)
5. ✅ **Git Repository** - Code pushed to GitHub/GitLab/Bitbucket

---

## Deployment Platforms

### Vercel (Recommended)

Vercel is the recommended platform for Next.js applications.

#### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub/GitLab/Bitbucket account
3. Click **Add New Project**
4. Import your repository

#### Step 2: Configure Project

1. **Project Name:** `tsmart-warehouse` (or your preferred name)
2. **Framework Preset:** Next.js (auto-detected)
3. **Root Directory:** `./` (default)
4. **Build Command:** `npm run build` (default)
5. **Output Directory:** `.next` (default)
6. **Install Command:** `npm install` (default)

#### Step 3: Environment Variables

Add all required environment variables in Vercel dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add each variable from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)
   - `NEXT_PUBLIC_SITE_URL` (your production URL)
   - Any notification service keys (SendGrid, Twilio, etc.)

**Important:** Set variables for **Production**, **Preview**, and **Development** environments as needed.

#### Step 4: Deploy

1. Click **Deploy**
2. Wait for build to complete (usually 2-5 minutes)
3. Your app will be live at `https://your-project.vercel.app`

#### Step 5: Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL certificate is automatically provisioned

#### Vercel-Specific Configuration

Create `vercel.json` (optional):

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

---

### Netlify

#### Step 1: Connect Repository

1. Go to [netlify.com](https://netlify.com)
2. Sign in and click **New site from Git**
3. Connect your repository

#### Step 2: Build Settings

- **Build command:** `npm run build`
- **Publish directory:** `.next`
- **Node version:** `18.x` or `20.x`

#### Step 3: Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Add all required variables (same as Vercel)

#### Step 4: Deploy

1. Click **Deploy site**
2. Your app will be live at `https://random-name.netlify.app`

#### Netlify-Specific Configuration

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"
```

---

### Self-Hosted

For self-hosted deployments (VPS, dedicated server, etc.):

#### Step 1: Server Requirements

- **Node.js:** 18.x or 20.x
- **npm:** 9.x or later
- **Memory:** Minimum 2GB RAM
- **Storage:** Minimum 10GB
- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+

#### Step 2: Install Dependencies

```bash
# Clone repository
git clone https://github.com/your-org/tsmart-warehouse.git
cd tsmart-warehouse

# Install dependencies
npm install --production
```

#### Step 3: Build Application

```bash
# Build for production
npm run build
```

#### Step 4: Configure Environment

Create `.env.production`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NODE_ENV=production
```

#### Step 5: Run with PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "tsmart-warehouse" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### Step 6: Configure Nginx (Reverse Proxy)

Create `/etc/nginx/sites-available/tsmart-warehouse`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/tsmart-warehouse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 7: SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

---

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] All environment variables are set
- [ ] Database migrations have been run
- [ ] Supabase Storage buckets are configured
- [ ] Email verification is enabled in Supabase
- [ ] RLS policies are configured
- [ ] Error tracking is set up (Sentry, etc.)
- [ ] Monitoring is configured
- [ ] Backup strategy is in place
- [ ] Custom domain is configured (if applicable)
- [ ] SSL certificate is active
- [ ] API rate limiting is configured
- [ ] CORS is properly configured
- [ ] File upload limits are set
- [ ] Notification services are configured
- [ ] Payment gateway is configured (if applicable)

---

## Environment Configuration

### Production Environment Variables

Required variables for production:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NODE_ENV=production

# Email (SendGrid or AWS SES)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=notifications@yourdomain.com

# SMS (Optional)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Error Tracking (Optional)
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production

# Rate Limiting (Optional - Upstash Redis)
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

---

## Database Setup

### 1. Run Migrations

Ensure all database migrations are applied:

1. Go to Supabase Dashboard → SQL Editor
2. Run all migration files in order:
   - `001_initial_schema.sql`
   - `001_create_profiles_table.sql`
   - `002_notification_preferences.sql`
   - `003_enable_realtime.sql`
   - `003_payments_schema.sql`

### 2. Configure RLS Policies

Set up Row Level Security policies for production:

```sql
-- Example: Users can only view their own bookings
CREATE POLICY "Users can view own bookings"
ON bookings FOR SELECT
USING (customer_id = auth.uid());

-- Example: Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
ON bookings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
```

### 3. Seed Initial Data

Seed warehouse configuration and initial data:

```sql
-- Insert warehouse
INSERT INTO warehouses (id, name, address, city, state, zip_code, total_sq_ft)
VALUES ('wh-001', 'TSmart Warehouse', '123 Main St', 'City', 'State', '12345', 240000);

-- Insert floors, halls, zones...
```

---

## Storage Setup

### Supabase Storage Buckets

1. Go to Supabase Dashboard → Storage
2. Create buckets:
   - `claim-evidence` - For claim evidence files
   - `invoices` - For invoice PDFs
   - `avatars` - For user avatars

3. Configure bucket policies:

```sql
-- Allow authenticated users to upload to claim-evidence
CREATE POLICY "Users can upload claim evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'claim-evidence' AND
  auth.role() = 'authenticated'
);

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'claim-evidence' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Post-Deployment

### 1. Verify Deployment

- [ ] Visit production URL
- [ ] Test authentication (login/register)
- [ ] Test API endpoints
- [ ] Verify database connections
- [ ] Check file uploads
- [ ] Test notifications

### 2. Performance Optimization

- [ ] Enable Next.js Image Optimization
- [ ] Configure CDN (if applicable)
- [ ] Set up caching headers
- [ ] Enable compression
- [ ] Monitor bundle size

### 3. Security Hardening

- [ ] Review RLS policies
- [ ] Enable Supabase Auth email verification
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Review API security headers
- [ ] Enable HTTPS only
- [ ] Set secure cookie flags

---

## Monitoring & Maintenance

### Error Tracking

Set up error tracking with Sentry:

1. Create Sentry project
2. Add `SENTRY_DSN` to environment variables
3. Install Sentry SDK (already in dependencies)
4. Configure in `next.config.mjs`

### Logging

- **Vercel:** Automatic logging in dashboard
- **Netlify:** Logs in Functions tab
- **Self-Hosted:** Use PM2 logs or systemd journal

### Monitoring

Monitor:
- API response times
- Error rates
- Database query performance
- Storage usage
- User activity

### Backup Strategy

1. **Database Backups:**
   - Supabase provides automatic daily backups
   - Configure additional backups if needed

2. **File Storage Backups:**
   - Regular exports of Supabase Storage
   - Or use Supabase backup feature

3. **Code Backups:**
   - Git repository (GitHub/GitLab)
   - Tag releases for easy rollback

### Updates & Maintenance

1. **Regular Updates:**
   ```bash
   npm update
   npm audit fix
   ```

2. **Database Migrations:**
   - Test migrations in staging first
   - Run migrations during maintenance window
   - Have rollback plan ready

3. **Dependency Updates:**
   - Review changelogs
   - Test in development
   - Deploy to staging
   - Deploy to production

---

## Troubleshooting

### Build Failures

**Error:** `Module not found`
- Check all dependencies are in `package.json`
- Run `npm install` locally to verify

**Error:** `TypeScript errors`
- Fix TypeScript errors or set `ignoreBuildErrors: true` in `next.config.mjs` (not recommended)

### Runtime Errors

**Error:** `Database connection failed`
- Verify Supabase URL and keys
- Check Supabase project is active
- Verify network connectivity

**Error:** `Authentication not working`
- Check Supabase Auth configuration
- Verify email templates are set up
- Check redirect URLs in Supabase dashboard

### Performance Issues

**Slow API responses:**
- Check database query performance
- Review indexes
- Enable query caching
- Check Supabase project limits

**High memory usage:**
- Review Next.js build configuration
- Enable image optimization
- Check for memory leaks

---

## Rollback Procedure

If deployment fails:

### Vercel
1. Go to Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

### Netlify
1. Go to Deploys
2. Find previous successful deployment
3. Click "..." → "Publish deploy"

### Self-Hosted
```bash
# Revert to previous Git commit
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart tsmart-warehouse
```

---

## Support

For deployment issues:

1. Check platform-specific documentation
2. Review error logs
3. Check Supabase status page
4. Review application logs
5. Contact support with error details

---

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Project README](../README.md)
- [Developer Setup Guide](./DEVELOPER_SETUP.md)

