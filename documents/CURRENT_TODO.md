# TSmart Warehouse - Current TODO List

**Date**: February 2, 2026  
**Sprint**: 15 (Jan 10-24, 2026)  
**Focus**: Polish & Complete Remaining Features

---

## 📋 Session / Recent Fixes

### 2026-02-03: created_by ve updated_by – tüm public tablolara
- **Amaç**: Kimin kayıt eklediğini ve kimin son güncellediğini takip etmek.
- **Migration**: `supabase/migrations/20260203100000_add_created_by_updated_by_to_tables.sql`
- **Yapılanlar**:
  1. Tüm `public` şemasındaki tablolara `created_by` ve `updated_by` sütunları eklendi (yoksa). Referans: `auth.users(id)` ON DELETE SET NULL.
  2. `set_created_by_column()`: INSERT sırasında `created_by` null ise `auth.uid()` atanıyor.
  3. `set_updated_by_column()`: UPDATE sırasında `updated_by` her zaman `auth.uid()` yapılıyor.
  4. Her iki sütun için BEFORE INSERT / BEFORE UPDATE trigger’ları tüm ilgili tablolara uygulandı.
  5. `created_by` ve `updated_by` üzerinde sorgu için index’ler eklendi.
- **Not**: Zaten `created_by` veya `updated_by` olan tablolar (örn. client_teams, floor_plans) sütun eklemede atlanıyor; trigger’lar yine ekleniyor. Uygulamak için: `supabase link` ile proje bağlandıktan sonra `supabase db push` (veya remote’da migration’ları çalıştır).

### 2026-02-02: How to Use page (English, all user types)
- **Page**: `/how-to-use` – public page under `(legal)` layout with header “Back to Home” and footer links.
- **Content (English)**: Overview of Warebnb; Getting Started (register, login, dashboard); **By User Type**: System Admin (root), Warehouse Owner (warehouse_admin), Warehouse Manager (warehouse_supervisor), Customer (warehouse_client – individual & corporate), Warehouse Staff, Warehouse Finder, Reseller/Broker, End Delivery Party, Local Transport, International Transport; Common Flows (booking, team management, warehouse operations); links to Terms, Privacy, Home.
- **Landing page footer**: “How to Use” link added under Company section (with How It Works, Features, Contact).
- **Dashboard sidebar**: “How to Use” link at bottom for all logged-in users; opens in new tab; tooltip when sidebar collapsed.
- **Legal layout footer**: How to Use, Terms, Privacy, Admin links added for consistency on legal/how-to-use pages.

### 2026-02-02: My Organization – team rename & delete (admin only, admin-in-team guard)
- **Teams section** (My Organization → Team Members): Admin can use the dropdown on each team badge for **Rename** and **Delete team**.
- **Rename**: Opens "Takımı düzenle" dialog (name + description); submits via `PATCH /api/v1/client-teams/[companyId]/[teamId]`.
- **Delete team**: Disabled when the team is the default or has any admin member (`has_admin_member` from API). Tooltip explains: "Varsayılan takım silinemez." / "Bu takımda admin kullanıcı var. Önce bu kullanıcıları başka takıma taşıyın." When allowed, click opens confirmation dialog "Takımı sil" and calls `DELETE /api/v1/client-teams/[companyId]/[teamId]`.
- **API**: Already enforced – default team and teams with admin members cannot be deleted; users must be moved first.

### 2026-02-02: Booking requests – company admin edit/delete, English status labels
- **`/dashboard/bookings/requests`**: Company admin (and requester/customer) can **edit** and **delete** existing booking requests.
- **API**: `PATCH /api/v1/booking-requests/[id]` and `DELETE /api/v1/booking-requests/[id]` with `canManageRequest()` (requester, customer, or company admin via `profiles.company_id`). GET response includes `can_edit` and `can_delete` per request.
- **UI**: Edit dialog (all request fields + Requires approval / Pre-approved), delete confirmation AlertDialog. Buttons shown only when `can_edit` / `can_delete` are true.
- **Status labels**: Request status badges now show English labels: Pending, Quoted, Approved, Rejected (via `statusLabel` map) instead of raw DB values.

### 2026-02-02: Booking entry modal & book-on-behalf flow
- **Entry modal** on `/dashboard/bookings/new`: On load, a modal asks "Who is this booking for?" with two options: **For myself** (book for own company) and **For another client** (book on behalf of a team member; approval may be required).
- **New booking page**:
  - After choice, if "For another client" the **BookOnBehalfSelector** is shown (team member picker + approval switch for admins; members always require approval).
  - Search form submit: if "for another client" and a member is selected, **booking-on-behalf context** is stored in `sessionStorage` and user is redirected to `/find-warehouses?...`.
- **Booking context** (`lib/booking-context.ts`): `getBookingOnBehalfContext`, `setBookingOnBehalfContext`, `clearBookingOnBehalfContext` for persisting on-behalf choice across the flow.
- **Warehouse book flows** now consume context:
  - **Marketplace warehouse detail** (`components/marketplace/warehouse-detail-view.tsx`): On confirm booking, if context exists, calls `POST /api/v1/bookings/on-behalf` with same params + context, then clears context and redirects to booking detail. Banner "Booking on behalf of {name}" shown when context is set.
  - **Dashboard book page** (`app/(dashboard)/warehouses/[id]/book/page.tsx`): Same logic on submit; banner "Booking on behalf of {name}" when context is set.
- **Result**: User can choose "for self" or "for another client" once on New Booking; if "another client", they select a team member (and admins can choose pre-approved vs require approval); search redirects to find-warehouses; when they complete a booking, it is created on behalf of the selected client and context is cleared.

---

### 2026-02-02: Warehouse client "My Company" visibility
- **Issue**: Warehouse client kullanıcı company'ye sahip olsa bile (company_id varsa) dashboard sidebar'da "My Company" görünmüyordu; sadece corporate client'lar için gösteriliyordu.
- **Fix**:
  1. **Sidebar** (`components/dashboard/sidebar.tsx`): `warehouseClientHasCompany` eklendi – `userRole === 'warehouse_client' && !!profile?.companyId` durumunda "My Company" linki gösteriliyor.
  2. **My Company sayfası** (`app/(dashboard)/dashboard/my-company/page.tsx`): `warehouse_client` + `company_id` olan tüm kullanıcılar sayfaya erişebiliyor; sadece corporate değil, company_id olan her warehouse client erişim alıyor. Başlık "My Company" olarak kalıyor (corporate için "My Organization").
- **Sonuç**: Company’si olan her warehouse client dashboard’da "My Company" görüyor ve sayfaya girebiliyor.

---

### 2026-02-02: Corporate register – company autocomplete, select vs create, admin/team admin fix
- **Company name**: Klavyeden yazarken `status = true` client_company'ler listeleniyor. Tam eşleşme varsa listeden seçim zorunlu; yoksa yeni company oluşturuluyor.
- **Form**: `selectedCompanyId` + submit'te `companyId`. Backend: corporate akışı trigger'dan bağımsız; yeni company = admin + team admin; profil upsert ile company_id/client_type yazılıyor; dashboard'da My Company görünüyor.

---

## 🔴 HIGH PRIORITY - This Week

### 1. Test All New Features
**Estimated Time**: 2 days  
**Assignee**: QA Team

#### CRM System Testing
- [ ] Create test warehouse_finder user account
- [ ] Create test reseller user account
- [ ] Test contact creation flow
- [ ] Test activity logging (calls, visits, emails)
- [ ] Test pipeline stage advancement
- [ ] Test admin approval workflow
- [ ] Test location-based warehouse discovery
- [ ] Test metrics dashboard calculations

#### Legal Agreements Testing
- [ ] Test new user registration with agreements
- [ ] Test agreement acceptance flow
- [ ] Test agreement modal display
- [ ] Test KolaySign signature request creation
- [ ] Test signature webhook handling
- [ ] Test agreement version tracking

#### Booking & Payment Testing
- [ ] Test booking with service selection
- [ ] Test price calculation with services
- [ ] Test payment intent creation
- [ ] Test Stripe payment flow
- [ ] Test booking confirmation
- [ ] Test booking details display

---

### 2. Complete Missing CRM Components
**Estimated Time**: 3 days  
**Assignee**: Frontend Team

- [ ] **PipelineKanban.tsx** - Drag-and-drop Kanban board
  - Use `@hello-pangea/dnd` library
  - 10 columns (10% to 100%)
  - Drag contacts between stages
  - Quick action buttons (call, email, visit)
  - Priority indicators
  - Location: `components/crm/PipelineKanban.tsx`

- [ ] **ActivityLoggerModal.tsx** - Quick activity logging
  - Modal form for logging activities
  - Activity type selector (call, email, visit, meeting, note)
  - Date/time picker
  - Outcome selector
  - Notes field
  - Auto-update last contact date
  - Location: `components/crm/ActivityLoggerModal.tsx`

- [ ] **MetricsDashboard.tsx** - Enhanced metrics display
  - Conversion funnel chart
  - Activity timeline chart
  - Pipeline stage distribution
  - Performance trends
  - Comparison with team average
  - Location: `components/crm/MetricsDashboard.tsx`

---

### 3. Complete Missing Agreement Templates
**Estimated Time**: 2 days  
**Assignee**: Legal Team + Developer

- [ ] **Cookie Policy** (`features/agreements/templates/cookie-policy.md`)
  - Types of cookies used
  - Cookie management options
  - Third-party cookies disclosure
  - KVKK/GDPR compliance

- [ ] **Reseller Partnership Agreement** (`features/agreements/templates/reseller-partnership.md`)
  - Commission structure
  - Performance requirements
  - Territory/exclusivity terms
  - Payment terms
  - Termination conditions

- [ ] **Warehouse Finder Agreement** (`features/agreements/templates/warehouse-finder-agreement.md`)
  - Commission structure
  - Lead ownership rules
  - Performance metrics
  - Payment terms
  - Non-compete clause

- [ ] **Payment Terms & Conditions** (`features/agreements/templates/payment-terms.md`)
  - Payment methods accepted
  - Payment schedule
  - Late payment penalties
  - Refund policy reference
  - Dispute resolution

- [ ] **Insurance & Liability Policy** (`features/agreements/templates/insurance-liability.md`)
  - Insurance requirements
  - Liability limitations
  - Claims process
  - Coverage details
  - Force majeure

- [ ] **Data Processing Agreement (DPA)** (`features/agreements/templates/dpa.md`)
  - KVKK/GDPR compliance
  - Data processing purposes
  - Data retention periods
  - Data subject rights
  - Security measures

- [ ] **Service Level Agreement (SLA)** (`features/agreements/templates/sla.md`)
  - Uptime guarantees
  - Response times
  - Support levels
  - Compensation for downtime
  - Maintenance windows

---

### 4. Create Legal Agreement Pages
**Estimated Time**: 1 day  
**Assignee**: Frontend Team

- [ ] **Terms of Service Page** (`app/(public)/legal/terms/page.tsx`)
  - Display current ToS
  - Version history
  - Last updated date
  - Download PDF option
  - Print-friendly format

- [ ] **Privacy Policy Page** (`app/(public)/legal/privacy/page.tsx`)
  - Display current privacy policy
  - KVKK compliance notice
  - Contact information for privacy concerns
  - Data request form link
  - Download PDF option

- [ ] **Cookie Policy Page** (`app/(public)/legal/cookies/page.tsx`)
  - Display cookie policy
  - Cookie preference manager
  - List of cookies used
  - Opt-out instructions

- [ ] **Cookie Consent Banner** (`components/legal/CookieBanner.tsx`)
  - First-visit popup
  - Accept all / Reject all / Customize buttons
  - Remember user preference
  - Link to cookie policy

---

### 5. Create Admin CRM Management Pages
**Estimated Time**: 2 days  
**Assignee**: Frontend Team

- [ ] **Approval Queue Page** (`app/(admin)/admin/crm/approvals/page.tsx`)
  - List of pending approvals
  - Filter by type (warehouse_supplier, customer_lead)
  - View contact details
  - Approve/Reject actions
  - Add approval notes
  - Notification to requester

- [ ] **Team Management Page** (`app/(admin)/admin/crm/team/page.tsx`)
  - List all warehouse finders and resellers
  - Performance metrics per user
  - Contact assignment
  - Set quotas and targets
  - Performance leaderboard
  - Activity tracking

- [ ] **Pipeline Configuration Page** (`app/(admin)/admin/crm/settings/page.tsx`)
  - Edit milestone definitions
  - Configure auto-advancement rules
  - Set notification templates
  - Customize pipeline stages
  - Configure approval requirements

---

## 🟡 MEDIUM PRIORITY - Next Week

### 6. Email Integration for Resellers
**Estimated Time**: 3 days  
**Assignee**: Backend + Frontend Team

- [ ] Choose email service provider (SendGrid, AWS SES, Resend)
- [ ] Set up email templates
- [ ] Create email composer component
- [ ] Implement email sending API
- [ ] Add email tracking (opens, clicks)
- [ ] Create email history view
- [ ] Add email templates library
- [ ] Implement scheduled emails

---

### 7. Enhanced Visit Features
**Estimated Time**: 2 days  
**Assignee**: Frontend Team

- [ ] **Visit Scheduler** - Calendar integration
  - Google Calendar sync
  - Visit reminders
  - Route optimization for multiple visits
  - Travel time estimation

- [ ] **Property Documentation** - Enhanced photo upload
  - Multiple photo upload
  - Photo categorization
  - Photo annotations
  - Property condition checklist
  - PDF report generation

---

### 8. Notification System
**Estimated Time**: 2 days  
**Assignee**: Backend Team

- [ ] Create notification templates
- [ ] Implement notification triggers
  - Contact moved to new stage
  - Admin approval requested
  - Admin approval granted/rejected
  - Visit reminder
  - Follow-up reminder
  - New activity on contact
- [ ] Add notification preferences
- [ ] Create notification center UI
- [ ] Add push notifications (FCM)
- [ ] Add email notifications

---

### 9. Documentation & Training
**Estimated Time**: 3 days  
**Assignee**: Tech Writer + Team Lead

#### User Documentation
- [ ] **Warehouse Finder Guide** (`docs/user-guides/warehouse-finder.md`)
  - Getting started
  - Adding contacts
  - Logging activities
  - Using the discovery map
  - Managing pipeline
  - Requesting approvals

- [ ] **Reseller Guide** (`docs/user-guides/reseller.md`)
  - Getting started
  - Adding leads
  - Multi-channel outreach
  - Creating proposals
  - Managing pipeline
  - Tracking performance

- [ ] **Admin Guide** (`docs/user-guides/admin-crm.md`)
  - CRM overview
  - Approval workflow
  - Team management
  - Pipeline configuration
  - Performance monitoring

#### Video Tutorials
- [ ] Record warehouse finder onboarding video (5-10 min)
- [ ] Record reseller onboarding video (5-10 min)
- [ ] Record admin CRM management video (10-15 min)

---

### 10. Performance Optimization
**Estimated Time**: 2 days  
**Assignee**: Backend Team

- [ ] Add database indexes for CRM queries
- [ ] Optimize location-based queries (PostGIS)
- [ ] Add caching for frequently accessed data
- [ ] Optimize API response times
- [ ] Add pagination to large lists
- [ ] Implement lazy loading for dashboards

---

## 🟢 LOW PRIORITY - Future Sprints

### 11. Advanced Features

#### Email Tracking Enhancement
- [ ] Email open tracking
- [ ] Link click tracking
- [ ] Email engagement scoring
- [ ] Best time to send analysis
- [ ] Email template A/B testing

#### Mobile Optimization
- [ ] Responsive design improvements
- [ ] Touch-friendly interactions
- [ ] Offline mode for field work
- [ ] Mobile photo upload optimization
- [ ] GPS location tracking for visits

#### Analytics & Reporting
- [ ] Custom report builder
- [ ] Export to Excel/PDF
- [ ] Scheduled reports
- [ ] Conversion funnel analysis
- [ ] Revenue forecasting
- [ ] Territory mapping

#### Integrations
- [ ] Google Calendar integration
- [ ] Outlook Calendar integration
- [ ] CRM export/import (CSV)
- [ ] Zapier integration
- [ ] Slack notifications
- [ ] WhatsApp Business API

---

## 📋 Testing Checklist

### Pre-Launch Testing
- [ ] Unit tests for all CRM API endpoints
- [ ] Integration tests for CRM workflows
- [ ] E2E tests for critical paths
- [ ] Load testing for database queries
- [ ] Security testing (RLS policies)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Accessibility testing (WCAG 2.1)

### User Acceptance Testing (UAT)
- [ ] Recruit 3 warehouse finders for pilot
- [ ] Recruit 3 resellers for pilot
- [ ] Recruit 2 admins for testing
- [ ] Create test scenarios
- [ ] Conduct UAT sessions
- [ ] Collect feedback
- [ ] Iterate based on feedback

---

## 🚀 Launch Plan

### Week 1 (Jan 10-17)
- ✅ Complete high priority tasks
- ✅ Test all new features
- ✅ Create missing components
- ✅ Complete agreement templates

### Week 2 (Jan 17-24)
- ✅ Complete medium priority tasks
- ✅ Create documentation
- ✅ Conduct internal testing
- ✅ Fix critical bugs

### Week 3 (Jan 24-31)
- ✅ Pilot launch with 3-5 users
- ✅ Monitor usage and performance
- ✅ Collect feedback
- ✅ Make adjustments

### Week 4 (Jan 31 - Feb 7)
- ✅ Full production launch
- ✅ Marketing campaign
- ✅ User onboarding
- ✅ Support setup

---

## 📊 Success Metrics

### Week 1 Goals
- [ ] All high priority tasks completed
- [ ] 0 critical bugs
- [ ] All tests passing
- [ ] Documentation 80% complete

### Week 2 Goals
- [ ] All medium priority tasks completed
- [ ] User guides published
- [ ] Video tutorials recorded
- [ ] Internal testing completed

### Week 3 Goals (Pilot)
- [ ] 3+ warehouse finders onboarded
- [ ] 3+ resellers onboarded
- [ ] 10+ contacts created
- [ ] 5+ activities logged per user
- [ ] User satisfaction > 4/5

### Week 4 Goals (Launch)
- [ ] 10+ active warehouse finders
- [ ] 10+ active resellers
- [ ] 50+ contacts in CRM
- [ ] 100+ activities logged
- [ ] 5+ conversions (first reservations/purchases)

---

## 🐛 Known Issues

### Critical
- None currently identified

### High
- [ ] Pipeline auto-advancement needs testing
- [ ] KolaySign webhook error handling needs improvement
- [ ] Location-based discovery accuracy needs verification

### Medium
- [ ] Dashboard loading time could be optimized
- [ ] Mobile layout needs minor adjustments
- [ ] Email notification templates need review

### Low
- [ ] Some UI polish needed on CRM pages
- [ ] Activity timeline could use better formatting
- [ ] Metrics charts need more customization options

---

## 💡 Ideas for Future Consideration

- AI-powered lead scoring
- Automated follow-up suggestions
- Voice notes for activities
- OCR for business cards
- Integration with LinkedIn
- Gamification (badges, achievements)
- Referral program for warehouse finders
- Commission tracking dashboard
- Contract management system
- Inventory tracking for warehouses

---

## 📞 Team Assignments

### Frontend Team
- CRM components (PipelineKanban, ActivityLoggerModal, MetricsDashboard)
- Legal pages (terms, privacy, cookies)
- Admin CRM pages (approvals, team, settings)
- Cookie consent banner

### Backend Team
- Email integration
- Notification system
- Performance optimization
- API enhancements

### Legal Team
- Agreement template review
- Legal compliance verification
- KVKK/GDPR audit

### QA Team
- Feature testing
- Bug tracking
- UAT coordination
- Test automation

### Tech Writer
- User documentation
- Video tutorials
- API documentation updates

---

## 📝 Daily Standup Questions

1. What did you complete yesterday?
2. What will you work on today?
3. Any blockers or issues?
4. Do you need help from anyone?

---

## 🎯 Sprint Goal

**Complete all high priority tasks and prepare for pilot launch by January 24, 2026**

**Definition of Done**:
- All high priority tasks completed
- All tests passing
- Documentation complete
- No critical bugs
- Ready for pilot users

---

**Last Updated**: January 10, 2026  
**Next Review**: January 13, 2026 (Monday)  
**Sprint End**: January 24, 2026

---

## Quick Links

- [Full TODO List](./TODO_LIST.md)
- [Git Pull Summary](./GIT_PULL_SUMMARY_2026-01-10.md)
- [Warehouse Finder & Reseller Roles](./WAREHOUSE_FINDER_RESELLER_ROLES.md)
- [Online Agreements](./ONLINE_AGREEMENTS.md)
- [Project README](../README.md)
