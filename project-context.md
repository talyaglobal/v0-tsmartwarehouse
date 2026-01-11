# TSmart Warehouse Project Context

## Project Overview
**Name**: TSmart Warehouse Management System
**Description**: Enterprise-grade warehouse management platform.
**Location**: `c:\IT\Projects\v0-Warebnb`

## Technology Stack
- **Framework**: Next.js 16.0.7 (App Router)
- **Language**: TypeScript 5+ (Strict Mode)
- **Styling**: Tailwind CSS 4.1.9, Radix UI, shadcn/ui
- **State Management**: Zustand, React Query
- **Database**: Supabase (PostgreSQL), Prisma (Client/ORM)
- **Auth**: Supabase Auth
- **Testing**: Jest, Playwright
- **External Integration**: Stripe (Payments), Firebase (mentioned in deps), Nodemailer (Email)

## Architecture
- **Feature-Based**: Code organized in `features/` (bookings, tasks, invoices).
- **Server-First**: Server Components default; Client Components only when needed.
- **Server Actions**: Used for mutations.
- **Micro-services/Integrations**: Webhooks for Stripe.

## Development Rules (Critical)
1.  **Migrations**:
    -   **AUTOMATICALLY PUSH**: Always run `npx supabase db push` after creating/modifying migrations.
    -   **NEVER** ask user to manually push.
2.  **Documentation**:
    -   All planning/docs go to `documents/`.
    -   Read `documents/` before starting work.
3.  **Language**:
    -   User-facing text: **English** (no Turkish).
    -   Code/Team communication: English preferred for code, user speaks Turkish.
4.  **Testing**:
    -   Maintain type safety.
    -   Write tests for new features.

## Key Directories
- `app/`: Next.js routes and pages.
- `features/`: Domain logic and components.
- `components/ui/`: Reusable UI components.
- `documents/`: Project documentation.
- `supabase/migrations/`: Database schemas.
- `prisma/`: Prisma client config (schema usually pulled from DB).

## Current State
- **Booking & Payment**: Being verified/implemented.
- **Migration Status**: Supabase migrations are the source of truth.
