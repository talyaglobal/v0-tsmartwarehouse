# Data Retention Policy

**Effective Date:** January 10, 2026  
**Version:** 1.0

## 1. Policy Overview

This Data Retention Policy ("Policy") outlines how TSmart Warehouse ("Platform") retains, stores, and deletes user data. This Policy ensures compliance with Turkish Personal Data Protection Law (KVKK), GDPR, and other applicable data protection regulations.

## 2. Purpose and Scope

2.1. **Purpose**:
- Comply with legal and regulatory requirements
- Support business operations and service delivery
- Protect user rights and privacy
- Enable data subject rights requests
- Minimize data retention to what is necessary

2.2. **Scope**: This Policy applies to all personal data and business data processed by Platform, including:
- User account information
- Booking and transaction data
- Communication records
- Usage and analytics data
- CRM and business data
- Technical logs and system data

## 3. Legal Basis for Retention

3.1. **Retention Justifications**:
- **Contractual**: Data necessary to fulfill services and contracts
- **Legal Obligation**: Data required by law (tax, accounting, legal proceedings)
- **Legitimate Interest**: Data for fraud prevention, security, business analytics
- **Consent**: Data retained with user's explicit consent (can be withdrawn)

3.2. **Turkish Legal Requirements**:
- **Tax Records**: 10 years (Turkish Tax Procedure Law)
- **Accounting Records**: 10 years (Turkish Commercial Code)
- **Employment Records**: 10 years after termination
- **Contracts**: 10 years after expiration

3.3. **International Requirements**:
- GDPR: Data retained only as long as necessary for purposes
- Various industry-specific regulations as applicable

## 4. Data Categories and Retention Periods

### 4.1 User Account Data

**Account Information:**
- Name, email, phone, address
- **Retention**: Duration of active account + 90 days grace period
- **After Deletion**: Deleted or anonymized
- **Exceptions**: Retained if legal obligation (e.g., ongoing dispute)

**Authentication Data:**
- Password hashes, MFA settings, login history
- **Retention**: Duration of active account
- **After Deletion**: Immediately deleted
- **Login History**: 2 years for security purposes

**Profile Photos and Documents:**
- User uploaded photos, ID documents (if provided)
- **Retention**: Duration of active account
- **After Deletion**: Deleted within 30 days

### 4.2 Booking and Transaction Data

**Booking Records:**
- Booking details, dates, warehouse information, services
- **Active Bookings**: Retained indefinitely during contract
- **Completed Bookings**: 7 years (legal obligation for contracts)
- **Cancelled Bookings**: 7 years (dispute resolution, accounting)

**Payment and Financial Data:**
- Payment method info (tokenized), invoices, receipts
- **Payment Tokens**: Until payment method deleted by user
- **Invoices**: 10 years (tax and accounting requirement)
- **Transaction History**: 10 years
- **Failed Payments**: 1 year (fraud prevention)

**Service Agreements:**
- Warehouse service contracts, terms
- **Duration**: Contract term + 7 years
- **Reason**: Legal obligation, dispute resolution

### 4.3 Communication Data

**Messages (In-Platform):**
- Direct messages between users, support tickets
- **Active Account**: Retained during account lifetime
- **Closed Tickets**: 3 years
- **After Account Deletion**: 30 days, then deleted
- **Exception**: Retained if part of legal claim

**Emails:**
- Transactional emails (booking confirmations, receipts)
- **Sent Records**: 3 years
- **Marketing Emails**: Until consent withdrawn + 6 months

**Phone Call Records:**
- Call logs (not recordings), duration, timestamps
- **Retention**: 2 years
- **Recordings** (if any): 90 days, then deleted

### 4.4 Marketing and Communication Consent

**Email Marketing Lists:**
- **Retention**: Until consent withdrawn
- **After Opt-Out**: 6 months (to honor opt-out and prevent re-add)
- **Suppression List**: Permanently (to prevent re-subscription)

**Cookie Preferences:**
- **Retention**: 12 months, then re-consent requested
- **After Withdrawal**: Immediately applied

### 4.5 CRM and Business Data

**CRM Contacts** (Resellers, Warehouse Finders):
- Contact information, activity history, pipeline data
- **Active Contacts**: Retained during business relationship
- **Inactive Contacts**: 5 years of inactivity
- **Partner Termination**: 3 years after partnership ends

**Sales and Lead Data:**
- Lead information, proposal history, performance metrics
- **Active Leads**: Retained during sales process
- **Won/Lost Deals**: 7 years (accounting, commission tracking)
- **Abandoned Leads**: 3 years

**CRM Activities:**
- Calls, emails, meetings, visits logged in CRM
- **Retention**: 5 years
- **Reason**: Business analytics, performance tracking

### 4.6 Warehouse Owner Data

**Warehouse Listings:**
- Warehouse details, photos, pricing, availability
- **Active Listings**: Retained while warehouse listed
- **Inactive/Deleted Listings**: 3 years (for users who may have bookmarked)
- **Exception**: Public listings may be retained longer for SEO and historical reference

**Warehouse Performance Data:**
- Ratings, reviews, booking history, revenue
- **Retention**: 7 years (business records, analytics)

**Compliance Documents:**
- Insurance certificates, licenses, permits
- **Retention**: 3 years after expiration
- **Reason**: Legal compliance, audit trail

### 4.7 Review and Rating Data

**Customer Reviews:**
- Review text, ratings, reviewer information
- **Retention**: Indefinitely while warehouse is listed
- **After Warehouse Delisting**: 3 years
- **Disputed Reviews**: Retained until dispute resolved + 2 years

**Review Responses:**
- Warehouse owner responses to reviews
- **Retention**: Same as reviews

### 4.8 Usage and Analytics Data

**Web Analytics:**
- Page views, sessions, user flows, device info
- **Identified Data**: 2 years
- **Anonymized/Aggregated**: Indefinitely

**Platform Logs:**
- Application logs, error logs, system events
- **Detailed Logs**: 90 days
- **Aggregated Logs**: 2 years
- **Security Logs**: 3 years

**API Usage Logs:**
- API requests, responses, errors
- **Detailed Logs**: 30 days
- **Aggregated/Analytics**: 2 years

### 4.9 Security and Fraud Prevention Data

**Security Logs:**
- Failed login attempts, suspicious activities, IP addresses
- **Retention**: 3 years
- **Reason**: Security investigations, fraud prevention

**Fraud Detection Data:**
- Device fingerprints, behavioral analysis, risk scores
- **Retention**: 3 years
- **Reason**: Fraud prevention, chargebacks

**Incident Reports:**
- Security incidents, data breaches, investigations
- **Retention**: 7 years
- **Reason**: Legal obligation, compliance

### 4.10 Legal and Compliance Data

**Agreements and Consents:**
- Terms of Service acceptances, agreement signatures
- **Retention**: Duration of relationship + 7 years
- **Reason**: Legal protection, dispute resolution

**KVKK/GDPR Requests:**
- Data subject access requests, deletion requests, logs
- **Retention**: 3 years after resolution
- **Reason**: Regulatory compliance, audit trail

**Litigation Data:**
- Documents, evidence, communications related to legal claims
- **Retention**: Duration of case + 10 years
- **Reason**: Legal obligation, appeals

### 4.11 Backup Data

**System Backups:**
- Complete platform backups
- **Retention**: 90 days (rolling)
- **Deletion**: Automatic after 90 days
- **Note**: Deleted data may persist in backups until backup expiration

**Database Snapshots:**
- Point-in-time database copies
- **Retention**: 30 days (rolling)

## 5. Data Deletion Procedures

5.1. **Scheduled Deletion**: Automated processes run:
- Daily: Expired session tokens, temporary files
- Weekly: Old logs, expired backup versions
- Monthly: Data past retention period
- Quarterly: Comprehensive data cleanup audit

5.2. **Secure Deletion Methods**:
- **Database**: DELETE operations with periodic VACUUM
- **Files**: Secure file deletion (overwrite)
- **Backups**: Encrypted backups deleted after retention
- **Logs**: Automatic rotation and deletion

5.3. **Verification**: Quarterly audits verify:
- Retention policies are enforced
- Automated deletion is functioning
- No unnecessary data accumulation
- Compliance with legal requirements

## 6. User Data Deletion Rights

6.1. **Account Deletion**:
- Users may request account deletion anytime
- Request via: Account settings or privacy@tsmart.com
- **Grace Period**: 90 days (account can be restored)
- **After Grace Period**: Data deleted per retention schedule

6.2. **Data Subject Rights** (KVKK/GDPR):
- Right to erasure ("Right to be Forgotten")
- Right to rectification
- Right to restrict processing
- Right to data portability

6.3. **Deletion Process**:
1. User submits deletion request
2. Platform verifies identity
3. Platform checks for legal retention obligations
4. Data deleted per schedule (immediate for non-retained data)
5. Confirmation sent to user within 30 days

6.4. **Exceptions to Deletion**:
- Data with legal retention obligation (tax, accounting)
- Data needed for ongoing legal claims
- Anonymized/aggregated data (no longer personal data)
- Data in backups (deleted when backup expires)

## 7. Data Minimization

7.1. **Collection Minimization**: Only collect data that is:
- Necessary for service provision
- Required by law
- Consented to by user for specific purpose

7.2. **Storage Minimization**: 
- Regularly review data to identify unnecessary data
- Delete data once purpose is fulfilled
- Anonymize data for long-term analytics (where possible)

7.3. **Access Minimization**:
- Limit employee access to data
- Role-based access controls
- Regular access reviews

## 8. Anonymization and Pseudonymization

8.1. **Anonymization**: After retention period:
- Personal identifiers removed
- Data aggregated
- No longer constitutes personal data
- Can be retained indefinitely for analytics

8.2. **Pseudonymization**: For active data:
- Replace identifiers with pseudonyms/tokens
- Reduce risk of identification
- Maintain ability to re-identify if necessary

8.3. **Use Cases**:
- Platform analytics and reporting
- Machine learning and AI training
- Market research
- Service improvement

## 9. Third-Party Data Processors

9.1. **Sub-Processor Retention**: Third-party processors must:
- Follow Platform's retention requirements
- Delete data upon instruction
- Not retain data longer than necessary
- Comply with KVKK and GDPR

9.2. **Sub-Processor List**: (See DPA Appendix B)
- Supabase: Database and authentication
- Stripe: Payment processing (7 years minimum for PCI)
- SendGrid: Email delivery
- Vercel: Hosting and logs

9.3. **Verification**: Platform verifies sub-processor compliance through:
- Contractual obligations
- Audits and certifications
- Regular reviews

## 10. Cross-Border Data Transfers

10.1. **Data Location**: Primary data stored in:
- EU Region (AWS Frankfurt) for EU customers
- Turkey (planned) for Turkish data residency

10.2. **Transfer Retention**: Data transferred internationally:
- Follows same retention policies
- Subject to local legal requirements (if more stringent)
- Deleted simultaneously across all locations

## 11. Employee and Contractor Data

11.1. **Employee Records**:
- Employment contracts, payroll, performance records
- **Retention**: 10 years after termination
- **Reason**: Turkish legal requirement

11.2. **Contractor Records**:
- Contracts, invoices, work product
- **Retention**: 10 years after contract end

11.3. **HR Data**:
- Applications, resumes, interview notes
- **Hired**: 10 years after employment ends
- **Not Hired**: 2 years after application

## 12. Inactive Account Handling

12.1. **Inactive Account Definition**:
- No login for 3 years
- No active bookings
- No response to reactivation emails

12.2. **Inactive Account Process**:
- **2 Years**: Reminder email
- **2.5 Years**: Final notice
- **3 Years**: Account marked for deletion
- **3 Years + 90 Days**: Account deleted (non-financial data)
- **Financial Data**: Retained per legal requirements

## 13. Breach and Incident Data

13.1. **Breach Investigation Data**:
- Logs, evidence, investigation notes
- **Retention**: 7 years after incident resolution
- **Reason**: Legal claims, regulatory requirements

13.2. **Affected User Notifications**:
- Breach notifications, communications
- **Retention**: 7 years

## 14. Changes to Retention Policy

14.1. **Review Schedule**: This Policy reviewed:
- Annually: Comprehensive review
- As Needed: When laws change or new data types added

14.2. **Notice of Changes**:
- 60 days advance notice for material changes
- Email notification and Platform announcement

14.3. **Retroactive Application**: Changes generally apply:
- Prospectively (to new data)
- Retroactively if required by law
- Not retroactively if it extends retention beyond user expectation

## 15. User Rights and Requests

15.1. **Data Access**: Users may request:
- Copy of all personal data held
- Response within 30 days (free)
- Extended response if complex (60 days with notice)

15.2. **Data Portability**: Users may request:
- Data in machine-readable format (JSON, CSV)
- Transfer to another service (where feasible)

15.3. **Rectification**: Users may request:
- Correction of inaccurate data
- Completion of incomplete data

15.4. **Restriction**: Users may request:
- Temporary restriction of processing
- While accuracy is verified or legal claim is pending

## 16. Accountability and Documentation

16.1. **Record of Processing Activities**: Platform maintains records of:
- Data categories processed
- Purposes of processing
- Retention periods applied
- Security measures

16.2. **Deletion Logs**: Platform logs:
- Data deletion events
- Automated deletion jobs
- User deletion requests

16.3. **Audits**: Regular audits to verify:
- Compliance with retention policies
- Proper deletion of expired data
- Accuracy of records

## 17. Contact Information

**Data Protection Officer (DPO):**
- Email: dpo@tsmart.com
- Phone: [DPO Phone]

**Privacy Team:**
- General inquiries: privacy@tsmart.com
- Data deletion requests: deletion@tsmart.com
- Data access requests: access@tsmart.com

**User Rights Requests:**
- Portal: https://tsmart.com/privacy/requests
- Email: requests@tsmart.com

---

## Data Retention Schedule Summary

| Data Category | Retention Period | Legal Basis |
|--------------|------------------|-------------|
| Active account data | Account lifetime + 90 days | Contract |
| Booking records | 7 years after completion | Legal obligation |
| Financial records | 10 years | Legal obligation (tax) |
| Communications | 3 years | Legitimate interest |
| CRM data | 5 years | Legitimate interest |
| Warehouse listings | 3 years after delisting | Business need |
| Reviews | Indefinite (while listed) | Legitimate interest |
| Usage analytics | 2 years | Legitimate interest |
| Security logs | 3 years | Legitimate interest |
| Legal documents | 7-10 years | Legal obligation |
| Backups | 90 days (rolling) | Technical necessity |
| Inactive accounts | 3 years of inactivity | Reasonable expectation |

---

## User Data Deletion Request Form

**Requester Information:**
- Full Name: _____________________
- Email: _____________________
- Account ID (if known): _____________________

**Request Type:**
- [ ] Delete entire account
- [ ] Delete specific data (specify): _____________________
- [ ] Export data before deletion

**Verification:**
I confirm that I am the account holder or authorized representative.

Signature: __________________ Date: __________

**Submit to:** deletion@tsmart.com or via account settings

**Response Time:** Within 30 days

---

## Acceptance

By using TSmart Warehouse, you acknowledge and accept this Data Retention Policy.

For questions about data retention or to exercise your data rights, contact: privacy@tsmart.com

---

*Last Updated: January 10, 2026*  
*Version: 1.0*

*This Policy is reviewed annually and updated as needed to reflect legal requirements and best practices.*
