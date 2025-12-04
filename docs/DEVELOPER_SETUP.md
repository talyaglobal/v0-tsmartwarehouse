# TSmart Warehouse Management System - Developer Setup Guide

**Version:** 1.0.0  
**Last Updated:** December 2024

This guide will help you set up your local development environment for the TSmart Warehouse Management System.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Node.js** (v18.x or v20.x)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **npm** (v9.x or later)
   - Comes with Node.js
   - Verify: `npm --version`

3. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify: `git --version`

4. **Code Editor**
   - Recommended: [VS Code](https://code.visualstudio.com/)
   - Extensions:
     - ESLint
     - Prettier
     - TypeScript
     - Tailwind CSS IntelliSense

### Required Accounts

1. **Supabase Account**
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project for development

2. **GitHub Account** (if contributing)
   - Sign up at [github.com](https://github.com)

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/tsmart-warehouse.git
cd tsmart-warehouse
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# See ENV_SETUP.md for details
```

### 4. Run Database Migrations

1. Go to Supabase Dashboard → SQL Editor
2. Run migration files from `supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `001_create_profiles_table.sql`
   - `002_notification_preferences.sql`
   - `003_enable_realtime.sql`
   - `003_payments_schema.sql`

### 5. Start Development Server

```bash
npm run dev
```

### 6. Open Application

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Detailed Setup

### Step 1: Install Node.js and npm

**macOS (using Homebrew):**
```bash
brew install node@20
```

**Windows:**
- Download installer from [nodejs.org](https://nodejs.org/)
- Run installer and follow prompts

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify Installation:**
```bash
node --version  # Should show v18.x or v20.x
npm --version   # Should show 9.x or later
```

### Step 2: Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/tsmart-warehouse.git

# Navigate to project directory
cd tsmart-warehouse
```

### Step 3: Install Dependencies

```bash
# Install all dependencies
npm install

# This will install:
# - Next.js and React
# - Supabase client libraries
# - UI components (Radix UI, Tailwind CSS)
# - Form handling (React Hook Form, Zod)
# - And other dependencies
```

### Step 4: Set Up Supabase

1. **Create Supabase Project:**
   - Go to [app.supabase.com](https://app.supabase.com)
   - Click "New Project"
   - Fill in project details
   - Wait for project to be created

2. **Get Credentials:**
   - Go to Settings → API
   - Copy:
     - Project URL
     - anon/public key
     - service_role key (keep secret!)

3. **Configure Environment:**
   ```bash
   # Create .env.local file
   cp .env.example .env.local
   
   # Edit .env.local and add your credentials
   ```

### Step 5: Run Database Migrations

1. **Using Supabase Dashboard (Recommended):**
   - Go to SQL Editor
   - Create new query
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run
   - Repeat for other migration files

2. **Using Supabase CLI (Advanced):**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Link to your project
   supabase link --project-ref your-project-ref
   
   # Push migrations
   supabase db push
   ```

### Step 6: Verify Setup

```bash
# Check environment variables
npm run check-env

# Expected output:
# ✅ Present environment variables:
#    NEXT_PUBLIC_SUPABASE_URL: https://...
#    NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJ...
# ✅ All required environment variables are set!
```

### Step 7: Start Development Server

```bash
npm run dev
```

You should see:
```
▲ Next.js 16.0.7
- Local:        http://localhost:3000
- Ready in 2.5s
```

---

## Development Workflow

### Running the Application

```bash
# Start development server
npm run dev

# Build for production (local testing)
npm run build
npm start

# Run linter
npm run lint
```

### Making Changes

1. **Create Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes:**
   - Edit files in your code editor
   - Changes auto-reload in browser (Hot Module Replacement)

3. **Test Changes:**
   - Test in browser at http://localhost:3000
   - Check console for errors
   - Test API endpoints

4. **Commit Changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

5. **Push to Remote:**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

The project uses:
- **ESLint** for linting
- **Prettier** for formatting (via ESLint)
- **TypeScript** for type checking

**Format Code:**
```bash
npm run lint -- --fix
```

### Type Checking

TypeScript is configured. Check types:
```bash
npx tsc --noEmit
```

---

## Project Structure

```
tsmart-warehouse/
├── app/                    # Next.js App Router pages
│   ├── (admin)/           # Admin role pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Customer dashboard pages
│   ├── (worker)/          # Worker role pages
│   ├── (legal)/           # Legal pages
│   └── api/               # API routes
├── components/            # React components
│   ├── admin/             # Admin components
│   ├── dashboard/         # Dashboard components
│   ├── worker/            # Worker components
│   └── ui/                # Reusable UI components
├── lib/                   # Utility libraries
│   ├── auth/              # Authentication utilities
│   ├── db/                # Database functions
│   ├── business-logic/    # Business logic
│   ├── supabase/          # Supabase clients
│   └── utils/             # General utilities
├── types/                 # TypeScript type definitions
├── supabase/              # Supabase migrations
│   └── migrations/        # SQL migration files
├── public/                # Static assets
├── docs/                  # Documentation
└── package.json           # Dependencies and scripts
```

### Key Directories

- **`app/`** - Next.js pages and API routes
- **`components/`** - Reusable React components
- **`lib/`** - Business logic and utilities
- **`types/`** - TypeScript type definitions
- **`supabase/migrations/`** - Database migrations

---

## Common Tasks

### Adding a New API Endpoint

1. Create route file: `app/api/v1/your-endpoint/route.ts`
2. Export HTTP methods: `GET`, `POST`, `PATCH`, `DELETE`
3. Use database functions from `lib/db/`
4. Handle errors with `handleApiError`

Example:
```typescript
import { NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/utils/logger"

export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ success: true, data: [] })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/your-endpoint" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
```

### Adding a New Database Table

1. Create migration file: `supabase/migrations/004_your_table.sql`
2. Define table schema with indexes
3. Add RLS policies
4. Create database functions in `lib/db/your-table.ts`
5. Run migration in Supabase SQL Editor

### Adding a New Page

1. Create page file: `app/(dashboard)/dashboard/your-page/page.tsx`
2. Use Server or Client Component as needed
3. Add navigation link in sidebar/header
4. Add route protection if needed

### Adding a New Component

1. Create component file: `components/your-component.tsx`
2. Use TypeScript for props
3. Follow existing component patterns
4. Export from component file

---

## Troubleshooting

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Kill process on port 3000
# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port:
PORT=3001 npm run dev
```

### Module Not Found

**Error:** `Cannot find module 'xyz'`

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

**Error:** Type errors in IDE

**Solution:**
```bash
# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Or check types manually
npx tsc --noEmit
```

### Database Connection Issues

**Error:** `Failed to connect to database`

**Solution:**
1. Verify `.env.local` has correct Supabase credentials
2. Check Supabase project is active (not paused)
3. Verify network connectivity
4. Check Supabase dashboard for errors

### Build Errors

**Error:** Build fails with TypeScript errors

**Solution:**
- Fix TypeScript errors
- Or temporarily set `ignoreBuildErrors: true` in `next.config.mjs` (not recommended)

### Hot Reload Not Working

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Restart dev server
npm run dev
```

---

## Development Tips

### Using Supabase Studio

Access Supabase Studio for database management:
- Go to Supabase Dashboard → Table Editor
- View and edit data directly
- Useful for testing and debugging

### Debugging API Routes

1. Add `console.log` statements
2. Check browser Network tab
3. Check server logs in terminal
4. Use Supabase dashboard logs

### Testing Authentication

1. Register a new user at `/register`
2. Check Supabase Auth → Users
3. Test login at `/login`
4. Verify session in browser cookies

### Database Queries

Test queries in Supabase SQL Editor before adding to code:
```sql
-- Example: Get all bookings
SELECT * FROM bookings LIMIT 10;
```

---

## Next Steps

After setting up your development environment:

1. ✅ Read [API Documentation](./API_DOCUMENTATION.md)
2. ✅ Review [Database Schema](./DATABASE_SCHEMA.md)
3. ✅ Check [Deployment Guide](./DEPLOYMENT_GUIDE.md)
4. ✅ Explore the codebase
5. ✅ Start developing!

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

## Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review project documentation in `docs/` folder
3. Check Supabase dashboard for errors
4. Review application logs
5. Ask for help in project discussions/Issues

---

**Happy Coding! 🚀**

