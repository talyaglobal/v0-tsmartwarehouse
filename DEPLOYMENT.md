# Deployment Guide

This guide covers deploying the TSmart Warehouse Management System to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Vercel Deployment](#vercel-deployment)
5. [Self-Hosted Deployment](#self-hosted-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring & Observability](#monitoring--observability)
8. [Production Checklist](#production-checklist)

## Prerequisites

- Node.js 20+ installed
- Docker and Docker Compose (for containerized deployment)
- Supabase project set up
- Stripe account configured
- Domain name (optional, for custom domain)

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env.local
```

### 2. Configure Required Variables

Edit `.env.local` and set the following required variables:

```env
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_live_your-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key

# Sentry (Error Tracking)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 3. Verify Configuration

```bash
npm run check-env
```

## Docker Deployment

### Build Docker Image

```bash
# Build the image
docker build -t tsmart-warehouse:latest .

# Or with Docker Compose
docker-compose build
```

### Run Container

```bash
# Run with Docker
docker run -p 3000:3000 --env-file .env.local tsmart-warehouse:latest

# Or with Docker Compose
docker-compose up -d
```

### Docker Compose Configuration

The `docker-compose.yml` file includes:
- Health checks
- Automatic restarts
- Environment variable management
- Port mapping

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### 3. Configure Environment Variables

In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.example`
3. Set different values for Production, Preview, and Development

### 4. Configure Build Settings

Vercel automatically detects Next.js projects. Ensure:
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm ci`

## Self-Hosted Deployment

### 1. Build the Application

```bash
# Install dependencies
npm ci

# Build for production
npm run build
```

### 2. Start Production Server

```bash
# Start the server
npm start
```

### 3. Use Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "tsmart-warehouse" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### 4. Configure Reverse Proxy (Nginx)

Example Nginx configuration:

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
    }
}
```

## CI/CD Pipeline

### GitHub Actions

The project includes GitHub Actions workflows:

1. **CI Pipeline** (`.github/workflows/ci.yml`)
   - Runs on every push and pull request
   - Lints and type checks code
   - Builds the application
   - Runs tests
   - Builds Docker images

2. **Release Pipeline** (`.github/workflows/release.yml`)
   - Runs on GitHub releases
   - Builds and pushes Docker images with version tags

### Setup CI/CD

1. **Enable GitHub Actions**
   - Go to repository Settings → Actions → General
   - Enable "Allow all actions and reusable workflows"

2. **Configure Secrets**
   - Go to repository Settings → Secrets and variables → Actions
   - Add required secrets:
     - `DOCKER_REGISTRY_TOKEN` (if using private registry)
     - `DEPLOYMENT_KEY` (for SSH deployment)

3. **Configure Environments**
   - Go to repository Settings → Environments
   - Create `staging` and `production` environments
   - Add environment-specific secrets

## Monitoring & Observability

### Error Tracking (Sentry)

1. **Create Sentry Project**
   - Go to [Sentry.io](https://sentry.io)
   - Create a new project (Next.js)
   - Copy the DSN

2. **Configure Sentry**
   - Add `SENTRY_DSN` to environment variables
   - Run Sentry wizard (optional):
     ```bash
     npx @sentry/wizard@latest -i nextjs
     ```

3. **Verify Integration**
   - Check Sentry dashboard for events
   - Test error reporting in development

### Performance Monitoring

The application includes built-in performance monitoring:

- API route performance tracking
- Database query timing
- Custom metric recording

Access metrics via:
```typescript
import { performanceMonitor } from "@/lib/monitoring/performance"

// Get all metrics
const metrics = performanceMonitor.getAllMetrics()

// Get average for specific metric
const avgTime = performanceMonitor.getAverage("api_route_booking")
```

### Health Checks

The application includes a health check endpoint:

```bash
curl https://yourdomain.com/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-20T10:00:00Z",
  "version": "1.0.0"
}
```

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] RLS policies configured
- [ ] Stripe keys set to production
- [ ] Sentry configured
- [ ] Error tracking tested
- [ ] Performance monitoring enabled
- [ ] SSL certificate configured
- [ ] Domain DNS configured
- [ ] Backup strategy in place

### Post-Deployment

- [ ] Health check endpoint responding
- [ ] Authentication working
- [ ] Database connections successful
- [ ] API routes responding
- [ ] Error tracking receiving events
- [ ] Performance metrics being collected
- [ ] Logs accessible
- [ ] Monitoring alerts configured

### Security

- [ ] Environment variables secured
- [ ] API rate limiting enabled
- [ ] CORS configured correctly
- [ ] Security headers set
- [ ] HTTPS enforced
- [ ] Secrets rotated regularly
- [ ] Access logs monitored

### Performance

- [ ] Build optimization enabled
- [ ] Image optimization configured
- [ ] CDN configured (if applicable)
- [ ] Caching strategy implemented
- [ ] Database indexes created
- [ ] Query performance optimized

## Troubleshooting

### Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Docker Issues

```bash
# Check container logs
docker logs <container-id>

# Check container health
docker ps

# Restart container
docker restart <container-id>
```

### Environment Variable Issues

```bash
# Verify environment variables
npm run check-env

# Check if variables are loaded
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

## Support

For deployment issues:
1. Check application logs
2. Review Sentry error reports
3. Check health endpoint
4. Verify environment variables
5. Review CI/CD pipeline logs

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Docker Documentation](https://docs.docker.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

