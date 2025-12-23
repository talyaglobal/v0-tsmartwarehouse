# TSmart Warehouse Management System

**Enterprise-grade warehouse management platform built with Next.js 16+**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/tsmarts-projects/v0-tsmartwarehouse)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

## 🚀 Overview

Modern, enterprise-grade warehouse management system featuring:
- **Feature-based architecture** (Domain-Driven Design)
- **Server Components & Server Actions** for optimal performance
- **Type-safe** development with TypeScript & Zod
- **State management** with Zustand
- **Real-time updates** with Supabase
- **Comprehensive testing** with Jest & Playwright

## 📚 Documentation

All documentation is located in the `/docs` folder:

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Detailed architecture documentation
- **[MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)** - Migration guide from old patterns
- **[MODERNIZATION_SUMMARY.md](./docs/MODERNIZATION_SUMMARY.md)** - Summary of modernization changes
- **[QUICK_START.md](./docs/QUICK_START.md)** - Quick start guide for developers
- **[API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)** - API documentation
- **[DEVELOPER_SETUP.md](./docs/DEVELOPER_SETUP.md)** - Developer setup guide

## 🏗️ Architecture

### Technology Stack

- **Framework:** Next.js 16.0.7 (App Router)
- **Language:** TypeScript 5+
- **Styling:** Tailwind CSS 4.1.9
- **UI Components:** Radix UI + shadcn/ui
- **State Management:** Zustand
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Testing:** Jest, Playwright

### Key Patterns

- ✅ **Server Components First** - Default to Server Components
- ✅ **Server Actions** - Type-safe mutations
- ✅ **Feature-Based Structure** - Domain-driven design
- ✅ **Result Type Pattern** - Type-safe error handling
- ✅ **Suspense Boundaries** - Optimized loading states

## 🚦 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Supabase account (for database & auth)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase credentials

# Run database migrations
npm run db:setup

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking
npm run format           # Format code with Prettier

# Testing
npm run test             # Run unit tests
npm run test:e2e         # Run E2E tests
npm run test:coverage    # Test coverage report
```

## 📁 Project Structure

```
tsmart-warehouse/
├── app/                    # Next.js App Router
│   ├── (admin)/           # Admin routes
│   ├── (auth)/            # Auth routes
│   ├── (dashboard)/       # Customer dashboard
│   └── api/               # API routes (legacy)
│
├── features/              # Feature-based modules
│   ├── bookings/         # Bookings feature
│   ├── tasks/            # Tasks feature
│   └── invoices/         # Invoices feature
│
├── components/            # Shared components
│   ├── ui/               # UI components (shadcn/ui)
│   └── ...
│
├── stores/               # Zustand stores
│   ├── auth.store.ts
│   └── ui.store.ts
│
├── lib/                  # Core libraries
│   ├── server/           # Server-only utilities
│   ├── client/           # Client-only utilities
│   └── shared/           # Shared utilities
│
└── types/                # TypeScript types
```

## 🔧 Development

### Creating a New Feature

1. Create feature folder:
   ```bash
   mkdir -p features/my-feature/{actions,components,lib}
   ```

2. Add Server Actions:
   ```tsx
   // features/my-feature/actions.ts
   'use server'
   export async function createMyFeatureAction(input: Input) {
     // ...
   }
   ```

3. Add Server Component queries:
   ```tsx
   // features/my-feature/lib/queries.ts
   import { cache } from 'react'
   export const getMyFeatureQuery = cache(async () => {
     // ...
   })
   ```

See [QUICK_START.md](./QUICK_START.md) for more examples.

## 🧪 Testing

```bash
# Run all tests
npm run test:all

# Unit tests
npm run test:unit

# Component tests
npm run test:component

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## 📦 Deployment

The project is configured for deployment on Vercel:

1. Push to main branch
2. Vercel automatically deploys
3. Environment variables configured in Vercel dashboard

## 🤝 Contributing

1. Create a feature branch
2. Follow the architecture patterns
3. Add tests for new features
4. Update documentation
5. Submit a pull request

## 📄 License

PROPRIETARY - TSmart Team

## 🔗 Links

- **Deployment:** [Vercel Dashboard](https://vercel.com/tsmarts-projects/v0-tsmartwarehouse)
- **Documentation:** See `/docs` folder
- **API Docs:** [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
