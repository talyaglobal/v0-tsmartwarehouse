# Warebnb (TSmart Warehouse) — Project TODO List for Ruflo

**Generated**: March 27, 2026
**Last Updated**: March 27, 2026 (post-ruflo push)
**Project Status**: ~75% Complete
**Tech Stack**: Next.js 16 + React 19 + TypeScript + Supabase + Prisma + Stripe

---

## Recently Completed (March 27, 2026)

- [x] Booking cancellation API with time-based refund policy (>48h=100%, 24-48h=50%, <24h=0%)
- [x] Stripe refund integration for cancelled bookings
- [x] Cron job to auto-expire unpaid bookings after 24h (`/api/cron/expire-unpaid-bookings`)
- [x] Payment retry card component for failed/timed-out deposits
- [x] Payment events audit trail table (`payment_events`)
- [x] Enhanced Stripe webhook handler (deposit success, checkout remaining, refund tracking)
- [x] DB migration: cancellation fields, refund tracking, payment_intent_id on bookings
- [x] Claude-flow / Ruflo infrastructure (`.claude/` agents, skills, commands, helpers)
- [x] MCP server configuration (`.mcp.json`)
- [x] Swarm memory & state setup (`.swarm/`)

---

## Legend

- `[x]` = Done
- `[ ]` = TODO
- Priority: **P0** = Critical/Blocker, **P1** = High, **P2** = Medium, **P3** = Low/Nice-to-have

---

## 1. TESTING (P0 — Currently at 0%)

Only 1 test file exists (`lib/planner/capacity.test.ts`). This is the biggest gap.

- [ ] **P0** Set up Jest/Vitest test configuration properly (jest.config or vitest.config)
- [ ] **P0** Write unit tests for core business logic:
  - [ ] `lib/business-logic/bookings.ts` — booking creation, confirmation, cancellation, refund calculation
  - [ ] `lib/business-logic/payments.ts` — payment processing, deposit calculations, refund processing
  - [ ] `lib/business-logic/pricing.ts` — dynamic pricing calculations
  - [ ] `lib/business-logic/invoices.ts` — invoice generation
  - [ ] `lib/business-logic/availability.ts` — availability checks
  - [ ] `lib/business-logic/capacity.ts` — capacity calculations (expand existing test)
  - [ ] `lib/business-logic/capacity-management.ts` — capacity management
  - [ ] `lib/business-logic/claims.ts` — claims processing
  - [ ] `lib/business-logic/orders.ts` — order workflows
  - [ ] `lib/business-logic/membership.ts` — membership tier logic
  - [ ] `lib/business-logic/teams.ts` — team management
  - [ ] `lib/business-logic/warehouse-staff.ts` — staff assignment & shifts
  - [ ] `lib/business-logic/tasks.ts` — task assignment & routing
  - [ ] `lib/business-logic/pallet-labels.ts` — pallet label generation
- [ ] **P1** Write API endpoint integration tests for critical flows:
  - [ ] Booking creation → confirmation → deposit → check-in → check-out
  - [ ] Booking cancellation → refund calculation → Stripe refund → capacity release
  - [ ] Cron: expire unpaid bookings (24h threshold)
  - [ ] Payment webhook handling (deposit, checkout_remaining, refund events)
  - [ ] Invoice generation → payment → settlement
  - [ ] User registration → company creation → team setup
  - [ ] Warehouse listing → availability check → booking
- [ ] **P1** Write component tests for key UI components (React Testing Library)
- [ ] **P2** Set up E2E testing framework (Playwright or Cypress)
- [ ] **P2** Write E2E tests for critical user journeys:
  - [ ] Customer booking flow end-to-end
  - [ ] Warehouse owner onboarding
  - [ ] Admin dashboard operations
  - [ ] Payment flow with Stripe test mode
- [ ] **P2** Add test execution to CI/CD pipeline (`.github/workflows/ci.yml`)
- [ ] **P3** Set up code coverage reporting and thresholds

---

## 2. AGREEMENT TEMPLATES (P0 — 5 of 20 done, 25%)

Templates completed:
- [x] Terms of Service
- [x] Privacy Policy
- [x] Warehouse Owner Service Agreement
- [x] Customer Booking Agreement
- [x] Cancellation & Refund Policy

Templates missing (15):
- [ ] **P0** Cookie Policy
- [ ] **P0** Payment Processing Terms
- [ ] **P0** Insurance & Liability Agreement
- [ ] **P1** Reseller Partnership Agreement
- [ ] **P1** Warehouse Finder Agreement
- [ ] **P1** Service Level Agreement (SLA)
- [ ] **P1** Escrow Agreement
- [ ] **P1** Data Processing Agreement (DPA)
- [ ] **P1** Non-Disclosure Agreement (NDA)
- [ ] **P2** Content & Listing Policy
- [ ] **P2** Review & Rating Policy
- [ ] **P2** Anti-Discrimination Policy
- [ ] **P2** Dispute Resolution Policy
- [ ] **P3** Affiliate Marketing Agreement
- [ ] **P3** Reseller-Customer Agreement

---

## 3. LEGAL & COMPLIANCE PAGES (P0)

- [ ] **P0** Implement `/legal/terms` page (render Terms of Service)
- [ ] **P0** Implement `/legal/privacy` page (render Privacy Policy)
- [ ] **P0** Implement `/legal/cookies` page (render Cookie Policy)
- [ ] **P0** Create Cookie Consent Banner component (KVKK/GDPR requirement)
- [ ] **P1** KVKK/GDPR data export functionality (user can download their data)
- [ ] **P1** KVKK/GDPR data deletion functionality (right to be forgotten)
- [ ] **P2** Marketing consent management (opt-in/opt-out)
- [ ] **P2** Agreement management admin dashboard

---

## 4. CRM UI COMPONENTS (P1 — 15% UI complete)

Backend/API for CRM is ~90% done. Missing frontend components:

- [ ] **P1** Pipeline Kanban view with drag-and-drop (`components/crm/`)
- [ ] **P1** Activity Logger Modal component
- [ ] **P1** Metrics Dashboard with advanced visualizations
- [ ] **P1** Deal value & revenue forecasting UI
- [ ] **P2** Email tracking dashboard (opens/clicks)
- [ ] **P2** Team performance leaderboard
- [ ] **P2** Visit scheduling & route optimization UI
- [ ] **P2** Property documentation component
- [ ] **P3** CRM search enhancements (advanced filters)

---

## 5. ADMIN CRM PAGES (P1)

- [ ] **P1** `/admin/crm/approvals` — Approval queue page
- [ ] **P1** `/admin/crm/team` — Team management page
- [ ] **P1** `/admin/crm/settings` — Pipeline configuration page
- [ ] **P2** Notification system for approval workflows

---

## 6. AGREEMENT UI COMPONENTS (P1 — 85% missing)

- [ ] **P1** Agreement Dashboard component (view/manage all agreements)
- [ ] **P1** Agreement Acceptance Flow component (step-by-step acceptance)
- [ ] **P1** Version History component (view agreement revision history)
- [ ] **P1** Signature Pad component (digital signature capture)
- [ ] **P1** Signature management components (view/verify signatures)
- [ ] **P2** Role-specific onboarding flows with agreement acceptance:
  - [ ] Warehouse Owner onboarding
  - [ ] Reseller onboarding
  - [ ] Warehouse Finder onboarding
  - [ ] Customer (corporate) onboarding

---

## 7. AGREEMENT INTEGRATION (P1 — 25% complete)

- [ ] **P1** Complete registration flow — store agreement metadata properly
- [ ] **P1** Integrate agreements into warehouse listing creation flow
- [ ] **P1** Integrate agreements into booking flow
- [ ] **P1** Integrate agreements into role activation flow
- [ ] **P1** Integrate agreements into payment flow
- [ ] **P2** Agreement seeding system (populate DB with default templates)

---

## 8. PDF GENERATION (P1 — 0% complete)

- [ ] **P1** Set up Puppeteer or Playwright for server-side PDF generation
- [ ] **P1** HTML → PDF conversion pipeline
- [ ] **P1** Agreement PDF generation (downloadable signed agreements)
- [ ] **P2** Invoice PDF generation
- [ ] **P2** Pallet label PDF generation

---

## 9. IN-CODE TODOs (P1-P2)

Fix these inline TODOs found in the codebase:

- [ ] **P1** `lib/business-logic/warehouse-staff.ts:330` — Implement full availability check using `getBookings` to filter conflicting bookings
- [ ] **P1** `lib/business-logic/tasks.ts:145` — Implement actual shift status check (currently hardcoded `true`)
- [ ] **P2** `components/marketplace/warehouse-card.tsx:139` — Implement favorite API call
- [ ] **P2** `app/api/webhooks/kolaysign/route.ts:109` — Send notification on signature status change
- [ ] **P2** `app/(dashboard)/dashboard/calendar/page.tsx:76` — Navigate to task detail
- [ ] **P2** `app/(dashboard)/warehouse-finder/page.tsx:58` — Calculate conversion rate from metrics (currently hardcoded `0`)

---

## 10. ENVIRONMENT & CONFIGURATION (P1)

- [ ] **P1** Create `.env.example` file documenting all required environment variables
- [ ] **P1** Remove Supabase credentials from `supabase/README.md` (security concern)
- [ ] **P1** Fix database migration tracking gap (migrations 002-103, 105-106, 108-114 missing from remote — see `supabase/README.md`)
- [ ] **P2** Document environment setup for new developers

---

## 11. CI/CD IMPROVEMENTS (P2)

Current CI: lint + type-check + build only.

- [ ] **P2** Add test execution step to GitHub Actions workflow
- [ ] **P2** Add security scanning (dependency audit, SAST)
- [ ] **P2** Add deployment automation (staging → production)
- [ ] **P3** Add E2E test step in CI pipeline
- [ ] **P3** Add bundle size monitoring
- [ ] **P3** Add Lighthouse performance checks

---

## 12. BOOKING & PAYMENT FOLLOW-UPS (P1-P2)

Cancellation, refund, and payment retry are now implemented. Remaining work:

- [ ] **P1** Wire PaymentRetryCard into booking detail pages (customer dashboard)
- [ ] **P1** Add cancellation button/flow to customer booking detail UI
- [ ] **P1** Admin UI for managing cancellations and reviewing refunds
- [ ] **P2** Email notification on booking cancellation (to customer + warehouse owner)
- [ ] **P2** Email notification on refund processed/failed
- [ ] **P2** Email notification on booking auto-expired (unpaid 24h)
- [ ] **P2** Vercel cron schedule configuration for expire-unpaid-bookings job
- [ ] **P3** Cancellation analytics (rates, reasons, refund totals)

---

## 13. NOTIFICATION SYSTEM ENHANCEMENTS (P2)

Core notification infrastructure exists (email, SMS, push, WhatsApp). Missing:

- [ ] **P2** Agreement-related notifications (acceptance confirmations, expiry reminders)
- [ ] **P2** Approval workflow notifications
- [ ] **P2** Booking reminder notifications (upcoming check-in/check-out)
- [ ] **P3** Notification analytics (delivery rates, engagement)

---

## 14. PERFORMANCE & OPTIMIZATION (P3)

- [ ] **P3** Bundle size audit and code splitting optimization
- [ ] **P3** Database query optimization (add missing indexes)
- [ ] **P3** Image optimization audit (lazy loading, proper sizing)
- [ ] **P3** API response caching strategy
- [ ] **P3** Server component vs client component audit

---

## 15. DOCUMENTATION (P3)

- [ ] **P3** API documentation (OpenAPI/Swagger spec for 193 endpoints)
- [ ] **P3** Developer onboarding guide
- [ ] **P3** Architecture decision records (ADRs)
- [ ] **P3** Deployment runbook
- [ ] **P3** User-facing help documentation

---

## 16. FUTURE FEATURES (P3 — Backlog)

- [ ] **P3** Rating & review system for warehouses
- [ ] **P3** Advanced search with filters (location, capacity, amenities)
- [ ] **P3** Mobile app (React Native or PWA)
- [ ] **P3** Internationalization (i18n) — full Turkish + English support
- [ ] **P3** Analytics dashboard for warehouse owners (occupancy trends, revenue)
- [ ] **P3** Automated pricing recommendations (ML-based)

---

## Summary by Priority

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | ~25 | Testing infrastructure, legal compliance, critical agreement templates |
| **P1** | ~40 | CRM UI, agreement integration, PDF generation, admin pages, booking/payment follow-ups, in-code fixes |
| **P2** | ~30 | CI/CD, notifications, onboarding flows, secondary templates, cancellation emails |
| **P3** | ~20 | Performance, documentation, future features |
| **Total** | **~115** | |

## Recommended Execution Order

1. **Week 1-2**: Testing setup + legal/compliance pages + cookie consent (P0)
2. **Week 3-4**: Agreement templates (remaining 15) + agreement UI components (P0/P1)
3. **Week 5-6**: CRM UI components + admin CRM pages (P1)
4. **Week 7-8**: Booking/payment follow-ups (cancellation UI, payment retry wiring, cron config) (P1)
5. **Week 9-10**: PDF generation + agreement integration into all flows (P1)
6. **Week 11-12**: Fix in-code TODOs + env/config cleanup + CI/CD improvements (P1/P2)
7. **Week 13-14**: Notification enhancements + onboarding flows (P2)
8. **Ongoing**: Performance, documentation, backlog features (P3)
