# Online Agreements for TSmart Warehouse Platform

> Comprehensive list of legal agreements required for the TSmart Warehouse marketplace platform

Last updated: January 9, 2026

## Table of Contents
- [Overview](#overview)
- [User Agreements](#user-agreements)
- [Business Agreements](#business-agreements)
- [Service Provider Agreements](#service-provider-agreements)
- [Transaction Agreements](#transaction-agreements)
- [Platform Policies](#platform-policies)
- [Implementation Requirements](#implementation-requirements)

---

## Overview

The TSmart Warehouse platform requires multiple legal agreements to govern relationships between:
- **Customers**: End users seeking warehouse services
- **Resellers**: Partners who promote and sell warehouse services
- **Warehouse Finders**: Agents who help match customers with warehouses
- **Warehouse Owners**: Property owners providing warehouse space and services

---

## User Agreements

### 1. Platform Terms of Service (ToS)
**Parties**: TSmart Warehouse Platform ↔ All Users

**Purpose**: Master agreement governing platform usage

**Key Sections**:
- Account registration and eligibility
- User responsibilities and prohibited activities
- Intellectual property rights
- Limitation of liability
- Dispute resolution and arbitration
- Termination and suspension policies
- Privacy and data protection
- Platform fees and payment terms

**Acceptance**: Required at registration, checkbox + "I Agree"

**Database Field**: `user_profiles.tos_accepted_at` (timestamp)

---

### 2. Privacy Policy
**Parties**: TSmart Warehouse Platform ↔ All Users

**Purpose**: Data collection, usage, and protection disclosure

**Key Sections**:
- Personal data collected
- How data is used and shared
- Cookie policy
- Third-party integrations (Google Maps, payment processors)
- User rights (access, deletion, portability)
- Data retention policies
- International data transfers
- Contact information for privacy concerns

**Acceptance**: Required at registration, separate from ToS

**Database Field**: `user_profiles.privacy_policy_accepted_at` (timestamp)

---

### 3. Cookie Policy
**Parties**: TSmart Warehouse Platform ↔ All Users

**Purpose**: Disclosure of cookie usage

**Key Sections**:
- Types of cookies used (essential, analytics, marketing)
- Cookie management and opt-out options
- Third-party cookies
- Cookie duration

**Acceptance**: Cookie banner on first visit

**Database Field**: `user_profiles.cookie_consent` (JSON: {essential, analytics, marketing})

---

## Business Agreements

### 4. Warehouse Owner Service Agreement
**Parties**: TSmart Warehouse Platform ↔ Warehouse Owners

**Purpose**: Terms for listing and providing warehouse services

**Key Sections**:
- Listing requirements and accuracy standards
- Service quality standards
- Pricing and commission structure (platform takes X%)
- Payment terms and schedule
- Insurance and liability requirements
- Property maintenance obligations
- Safety and compliance standards
- Booking cancellation policies
- Dispute resolution process
- Performance metrics and ratings
- Termination conditions

**Acceptance**: Required before first warehouse listing

**Database Field**: `warehouses.owner_agreement_accepted_at` (timestamp)

**Commission Structure**: 
- Platform fee: 15% of booking value
- Payment schedule: Net 30 days after service completion

---

### 5. Reseller Partnership Agreement
**Parties**: TSmart Warehouse Platform ↔ Resellers

**Purpose**: Terms for reselling warehouse services

**Key Sections**:
- Reseller responsibilities and obligations
- Commission structure and payment terms
- Marketing and branding guidelines
- Lead generation and customer acquisition
- Pricing authority and restrictions
- Performance targets and KPIs
- Confidentiality and non-compete clauses
- Territory restrictions (if applicable)
- Training and support provided
- Termination and renewal terms

**Acceptance**: Required before reseller account activation

**Database Field**: `user_profiles.reseller_agreement_accepted_at` (timestamp)

**Commission Structure**:
- Base commission: 10% of booking value
- Tiered bonuses: 12% for >10 bookings/month, 15% for >25 bookings/month
- Payment schedule: Monthly, Net 15 days

---

### 6. Warehouse Finder Agreement
**Parties**: TSmart Warehouse Platform ↔ Warehouse Finders

**Purpose**: Terms for finding and matching warehouse services

**Key Sections**:
- Finder responsibilities and duties
- Commission structure for successful matches
- Lead qualification requirements
- Customer introduction process
- Non-circumvention clauses
- Payment terms and conditions
- Performance metrics
- Confidentiality obligations
- Termination conditions

**Acceptance**: Required before finder account activation

**Database Field**: `user_profiles.finder_agreement_accepted_at` (timestamp)

**Commission Structure**:
- Finder fee: 5% of first year's booking value
- Minimum booking duration: 3 months
- Payment schedule: After customer's first payment

---

## Service Provider Agreements

### 7. Customer Booking Agreement
**Parties**: Customer ↔ Warehouse Owner (Platform facilitates)

**Purpose**: Terms for specific warehouse booking

**Key Sections**:
- Service description and specifications
- Booking duration and dates
- Pricing and payment schedule
- Deposit and cancellation terms
- Access and usage rights
- Prohibited uses and activities
- Insurance requirements
- Liability and indemnification
- Force majeure provisions
- Dispute resolution

**Acceptance**: Required at booking confirmation

**Database Field**: `bookings.customer_agreement_accepted_at` (timestamp)

**Generated**: Dynamically per booking with specific terms

---

### 8. Service Level Agreement (SLA)
**Parties**: TSmart Warehouse Platform ↔ Warehouse Owners

**Purpose**: Define service quality standards

**Key Sections**:
- Uptime and availability guarantees
- Response time requirements
- Quality standards for facilities
- Maintenance schedules
- Emergency procedures
- Performance penalties
- Reporting requirements

**Acceptance**: Part of Warehouse Owner Service Agreement

**Database Field**: `warehouses.sla_tier` (bronze, silver, gold, platinum)

---

### 9. Reseller-Customer Agreement
**Parties**: Reseller ↔ Customer (Platform oversees)

**Purpose**: Terms when reseller introduces customer

**Key Sections**:
- Reseller's role and limitations
- Customer obligations to reseller
- Commission disclosure
- Pricing transparency
- Direct platform relationship clause
- Dispute escalation to platform

**Acceptance**: Required when booking through reseller

**Database Field**: `bookings.reseller_agreement_accepted_at` (timestamp)

---

## Transaction Agreements

### 10. Payment Processing Agreement
**Parties**: TSmart Warehouse Platform ↔ All Users (Customers, Owners)

**Purpose**: Terms for payment processing

**Key Sections**:
- Accepted payment methods
- Payment processing fees
- Refund policies
- Chargeback procedures
- Currency and conversion
- Tax responsibilities
- Payment security (PCI compliance)
- Escrow terms (if applicable)

**Acceptance**: Required before first payment

**Database Field**: `user_profiles.payment_terms_accepted_at` (timestamp)

---

### 11. Cancellation and Refund Policy
**Parties**: Platform ↔ Customers & Warehouse Owners

**Purpose**: Define cancellation terms and refund procedures

**Key Sections**:
- Cancellation notice periods
- Refund calculation methods
- Cancellation fees
- Force majeure exceptions
- Dispute resolution
- Partial cancellations

**Tiered Structure**:
- >30 days notice: 100% refund
- 15-30 days notice: 75% refund
- 7-14 days notice: 50% refund
- <7 days notice: 25% refund
- No-show: 0% refund

**Acceptance**: Part of booking agreement

**Database Field**: `bookings.cancellation_policy_type` (flexible, moderate, strict)

---

### 12. Escrow Agreement
**Parties**: Customer ↔ Platform ↔ Warehouse Owner

**Purpose**: Secure payment holding until service completion

**Key Sections**:
- Escrow deposit requirements
- Release conditions and triggers
- Dispute handling during escrow
- Escrow fees
- Refund procedures from escrow
- Timeline for fund release

**Acceptance**: Automatic for bookings >$5,000

**Database Field**: `bookings.escrow_status` (pending, held, released, disputed)

---

## Platform Policies

### 13. Content and Listing Policy
**Parties**: Platform ↔ Warehouse Owners & Resellers

**Purpose**: Guidelines for content posted on platform

**Key Sections**:
- Photo and video requirements
- Prohibited content
- Accuracy requirements
- Intellectual property rights
- Content moderation process
- Removal and suspension policies

**Acceptance**: Part of owner/reseller agreements

---

### 14. Review and Rating Policy
**Parties**: Platform ↔ All Users

**Purpose**: Guidelines for reviews and ratings

**Key Sections**:
- Review eligibility (verified bookings only)
- Prohibited review content
- Response rights for owners
- Review moderation and removal
- Rating calculation methodology
- Dispute process for unfair reviews

**Acceptance**: Implied by platform usage

---

### 15. Insurance and Liability Policy
**Parties**: Platform ↔ Warehouse Owners

**Purpose**: Insurance requirements for warehouse operations

**Key Sections**:
- Minimum insurance coverage required
- Proof of insurance documentation
- Liability limits
- Platform's liability limitations
- Customer insurance recommendations
- Claims process

**Required Coverage**:
- General liability: $2M minimum
- Property insurance: Full replacement value
- Workers compensation: As required by law

**Acceptance**: Required before listing approval

**Database Field**: `warehouses.insurance_verified_at` (timestamp)

---

### 16. Data Processing Agreement (DPA)
**Parties**: Platform ↔ Business Users (Owners, Resellers)

**Purpose**: GDPR/CCPA compliance for data processing

**Key Sections**:
- Data processor vs. controller roles
- Data processing purposes
- Security measures
- Sub-processor disclosure
- Data breach notification
- Data subject rights
- International transfers
- Audit rights

**Acceptance**: Required for EU/CA users

**Database Field**: `user_profiles.dpa_accepted_at` (timestamp)

---

### 17. Non-Disclosure Agreement (NDA)
**Parties**: Platform ↔ Resellers & Finders

**Purpose**: Protect confidential business information

**Key Sections**:
- Definition of confidential information
- Permitted disclosures
- Non-disclosure obligations
- Duration of confidentiality
- Return of information
- Remedies for breach

**Acceptance**: Required for resellers and finders

**Database Field**: `user_profiles.nda_accepted_at` (timestamp)

---

### 18. Anti-Discrimination Policy
**Parties**: Platform ↔ All Users

**Purpose**: Ensure fair and equal access

**Key Sections**:
- Prohibited discrimination bases
- Warehouse owner obligations
- Reporting discrimination
- Investigation process
- Penalties for violations

**Acceptance**: Part of ToS

---

### 19. Dispute Resolution Agreement
**Parties**: Platform ↔ All Users

**Purpose**: Process for resolving disputes

**Key Sections**:
- Mediation requirements
- Arbitration clauses
- Class action waiver
- Governing law and jurisdiction
- Small claims court exception
- Platform's role in disputes

**Acceptance**: Part of ToS

---

### 20. Affiliate Marketing Agreement
**Parties**: Platform ↔ Affiliates (Resellers/Finders)

**Purpose**: Terms for marketing and promotion

**Key Sections**:
- Affiliate responsibilities
- Marketing guidelines and restrictions
- Prohibited marketing practices
- Commission structure
- Tracking and reporting
- Payment terms
- Termination conditions

**Acceptance**: Required for affiliate program

**Database Field**: `user_profiles.affiliate_agreement_accepted_at` (timestamp)

---

## Implementation Requirements

### Database Schema

```sql
-- Add agreement tracking to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS agreements_accepted JSONB DEFAULT '{}'::jsonb;

-- Structure:
{
  "tos": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z", "ip": "192.168.1.1"},
  "privacy_policy": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z", "ip": "192.168.1.1"},
  "cookie_consent": {"essential": true, "analytics": true, "marketing": false, "accepted_at": "2026-01-09T10:00:00Z"},
  "payment_terms": {"version": "1.0", "accepted_at": "2026-01-09T10:05:00Z"},
  "reseller_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:10:00Z"},
  "finder_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:10:00Z"},
  "nda": {"version": "1.0", "accepted_at": "2026-01-09T10:10:00Z"},
  "dpa": {"version": "1.0", "accepted_at": "2026-01-09T10:10:00Z"}
}

-- Add agreement tracking to warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS owner_agreements JSONB DEFAULT '{}'::jsonb;

-- Structure:
{
  "service_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
  "sla": {"tier": "gold", "version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
  "insurance_verified": {"verified_at": "2026-01-09T10:00:00Z", "expiry": "2027-01-09"}
}

-- Add agreement tracking to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_agreements JSONB DEFAULT '{}'::jsonb;

-- Structure:
{
  "customer_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
  "cancellation_policy": {"type": "moderate", "accepted_at": "2026-01-09T10:00:00Z"},
  "reseller_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"}
}
```

### Agreement Versioning

All agreements must be versioned to track changes:
- Version format: `MAJOR.MINOR` (e.g., "1.0", "1.1", "2.0")
- Major version: Requires re-acceptance
- Minor version: Notification only
- Store version accepted in database

### UI Components Needed

1. **Agreement Modal Component**
   - Display full agreement text
   - Scroll-to-bottom requirement
   - Checkbox acceptance
   - Digital signature (typed name)
   - Download PDF option

2. **Agreement Dashboard**
   - View all accepted agreements
   - Download copies
   - View version history
   - Re-accept updated agreements

3. **Agreement Notification System**
   - Alert users of updated agreements
   - Grace period for acceptance
   - Account restriction if not accepted

### Legal Review Requirements

All agreements must be reviewed by legal counsel for:
- Jurisdiction compliance (US, EU, UK, etc.)
- Industry-specific regulations
- Consumer protection laws
- Data protection regulations (GDPR, CCPA)
- Contract enforceability

### Agreement Storage

- Store agreement PDFs in Supabase Storage
- Path: `legal-documents/{agreement-type}/v{version}/{language}.pdf`
- Generate PDFs from markdown templates
- Support multiple languages

### Audit Trail

Track all agreement acceptances:
- User ID
- Agreement type and version
- Timestamp
- IP address
- User agent
- Method (web, mobile app, API)

---

## Agreement Priority and Flow

### For Customers:
1. Terms of Service (required at registration)
2. Privacy Policy (required at registration)
3. Cookie Policy (on first visit)
4. Payment Processing Agreement (before first booking)
5. Customer Booking Agreement (per booking)

### For Warehouse Owners:
1. Terms of Service (required at registration)
2. Privacy Policy (required at registration)
3. Warehouse Owner Service Agreement (before listing)
4. Service Level Agreement (before listing)
5. Insurance and Liability Policy (before listing)
6. Data Processing Agreement (if applicable)

### For Resellers:
1. Terms of Service (required at registration)
2. Privacy Policy (required at registration)
3. Reseller Partnership Agreement (before activation)
4. Non-Disclosure Agreement (before activation)
5. Affiliate Marketing Agreement (if applicable)
6. Data Processing Agreement (if applicable)

### For Warehouse Finders:
1. Terms of Service (required at registration)
2. Privacy Policy (required at registration)
3. Warehouse Finder Agreement (before activation)
4. Non-Disclosure Agreement (before activation)
5. Affiliate Marketing Agreement (if applicable)

---

## Compliance Checklist

- [ ] All agreements reviewed by legal counsel
- [ ] Agreements translated to required languages
- [ ] Database schema implemented for tracking
- [ ] UI components created for acceptance flow
- [ ] PDF generation system implemented
- [ ] Audit trail logging active
- [ ] Version control system in place
- [ ] User notification system for updates
- [ ] Agreement download functionality
- [ ] GDPR/CCPA compliance verified
- [ ] E-signature validity confirmed
- [ ] Dispute resolution process documented
- [ ] Insurance verification process automated
- [ ] Commission calculation system tested

---

## Next Steps

1. **Legal Review**: Engage legal counsel to draft all agreements
2. **Database Migration**: Implement agreement tracking schema
3. **UI Development**: Create agreement acceptance components
4. **PDF Generation**: Set up document generation system
5. **Testing**: Test agreement flow for all user types
6. **Compliance Audit**: Verify regulatory compliance
7. **Launch**: Deploy agreement system to production

---

## See Also
- [Development Rules](./DEVELOPMENT_RULES.md)
- [Setup Guide](./SETUP_GUIDE.md)
- [Booking Payment System](./BOOKING_PAYMENT_SYSTEM.md)
- [Warehouse Services Plan](./WAREHOUSE_SERVICES_PLAN.md)

---

**Document Status**: Draft - Requires Legal Review
**Last Updated**: January 9, 2026
**Next Review**: Before production launch

