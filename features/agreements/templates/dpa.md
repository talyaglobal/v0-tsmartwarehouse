# Data Processing Agreement (DPA)

**Effective Date:** January 10, 2026  
**Version:** 1.0

## 1. Introduction

This Data Processing Agreement ("DPA") forms part of the TSmart Warehouse Terms of Service and applies to the processing of personal data by TSmart Warehouse ("Data Processor" or "Platform") on behalf of customers, warehouse owners, and other users ("Data Controller" or "User").

This DPA complies with:
- Turkish Personal Data Protection Law (KVKK - Law No. 6698)
- European General Data Protection Regulation (GDPR) for EU data subjects
- Other applicable data protection laws

## 2. Definitions

**Personal Data**: Any information relating to an identified or identifiable natural person, including but not limited to:
- Name, email address, phone number
- IP address, device identifiers, location data
- Payment information
- Business contact information
- Usage data and behavioral information

**Processing**: Any operation performed on personal data, including:
- Collection, recording, organization, structuring
- Storage, adaptation, alteration
- Retrieval, consultation, use
- Disclosure, dissemination, transfer
- Alignment, restriction, erasure, destruction

**Data Subject**: The individual to whom personal data relates.

**Data Controller**: The entity that determines the purposes and means of processing personal data (the User).

**Data Processor**: TSmart Warehouse, which processes personal data on behalf of the Data Controller.

**Sub-processor**: Third-party processor engaged by TSmart Warehouse to process personal data.

**Supervisory Authority**: Turkish Personal Data Protection Authority (KVKK Kurumu) or relevant EU supervisory authority.

## 3. Scope and Applicability

3.1. **Application**: This DPA applies when:
- Warehouse Owners process customer personal data through the Platform
- Resellers and Warehouse Finders process contact data in the CRM
- Any user processes personal data of data subjects using Platform services

3.2. **Controller-Processor Relationship**:
- **User as Controller**: When User collects personal data of their customers, leads, or contacts
- **Platform as Processor**: Platform processes this data on User's instructions per this DPA

3.3. **Platform as Controller**: For Platform's own processing (user accounts, platform analytics, marketing), Platform acts as Controller under the Privacy Policy.

## 4. User's Responsibilities as Data Controller

4.1. **Legal Basis**: User must ensure:
- Lawful basis exists for all processing (consent, contract, legitimate interest, legal obligation)
- Compliance with all applicable data protection laws
- Proper notices provided to data subjects
- Valid consent obtained where required

4.2. **Data Subject Rights**: User is responsible for:
- Responding to data subject access requests
- Handling rectification, erasure, and restriction requests
- Providing data portability
- Managing consent withdrawals
- Handling objections to processing

4.3. **Data Quality**: User must:
- Ensure personal data is accurate and up-to-date
- Not collect or process excessive data
- Delete data when no longer necessary
- Correct inaccurate data promptly

4.4. **Instructions to Processor**: User's instructions to Platform must:
- Be lawful and compliant with data protection laws
- Be documented in writing (including via Platform interface)
- Not require Platform to violate laws or regulations

## 5. Platform's Responsibilities as Data Processor

5.1. **Processing Instructions**: Platform will:
- Process personal data only on documented instructions from User
- Process only for purposes of providing Platform services
- Not process for own purposes (except as Controller for Platform operations)
- Immediately inform User if instructions appear unlawful

5.2. **Confidentiality**: Platform ensures:
- All personnel with access to personal data are bound by confidentiality
- Access limited to personnel who need to know
- Confidentiality obligations survive termination of employment

5.3. **Security Measures**: Platform implements appropriate technical and organizational measures including:
- Encryption of data in transit (TLS 1.3) and at rest (AES-256)
- Access controls and authentication (MFA for sensitive operations)
- Regular security audits and penetration testing
- Security incident response procedures
- Backup and disaster recovery systems
- Pseudonymization where appropriate

5.4. **Data Breach Notification**:
- Platform notifies User within 48 hours of becoming aware of a personal data breach
- Notification includes: nature of breach, affected data, likely consequences, mitigation measures
- Platform cooperates with User's breach investigation and notification obligations

5.5. **Assistance to User**: Platform assists User (at User's cost) with:
- Data protection impact assessments (if Platform processing is relevant)
- Prior consultations with supervisory authorities
- Compliance with data subject rights requests
- Security incident investigations
- Audits and inspections by authorities

## 6. Sub-processors

6.1. **Authorization**: User authorizes Platform to engage sub-processors for specific processing activities.

6.2. **Current Sub-processors**:

| Sub-processor | Service | Location | Data Processed |
|--------------|---------|----------|----------------|
| Supabase Inc. | Database & Auth | USA (AWS - Europe regions) | All user data |
| Stripe Inc. | Payment Processing | USA (with EU/TR presence) | Payment data |
| Vercel Inc. | Hosting & CDN | USA (global edge network) | Usage data, logs |
| AWS (Amazon) | Cloud Infrastructure | Europe (EU-Central-1) | All platform data |
| SendGrid (Twilio) | Email Delivery | USA | Email addresses, comm. data |
| KolaySign | Digital Signatures | Turkey | Signature data, contact info |

6.3. **Sub-processor Obligations**: Platform ensures each sub-processor:
- Enters into written agreement with equivalent data protection obligations
- Implements appropriate security measures
- Complies with this DPA
- Is subject to audit rights

6.4. **Sub-processor Changes**:
- Platform provides 30 days notice of new or replacement sub-processors
- User may object on reasonable data protection grounds
- If objection sustained, User may terminate affected services

6.5. **Sub-processor Liability**: Platform remains fully liable to User for sub-processor performance.

## 7. International Data Transfers

7.1. **Transfer Mechanisms**: Personal data may be transferred to:
- European Economic Area (EEA): Adequate protection per GDPR
- United States: Standard Contractual Clauses (SCCs) + supplementary measures
- Other countries: Only with appropriate safeguards (SCCs, adequacy decisions, or consent)

7.2. **Standard Contractual Clauses**: For transfers outside Turkey/EEA, Platform has executed:
- EU Standard Contractual Clauses (2021 version)
- Supplementary measures per Schrems II requirements
- Transfer impact assessments for high-risk jurisdictions

7.3. **User Authorization**: By accepting this DPA, User authorizes international transfers to approved sub-processors using appropriate safeguards.

7.4. **Data Localization**: Platform stores primary data in:
- **EU Region** (AWS Europe/Frankfurt) for EU customers
- **Turkish Data Center** (in development) for Turkish data residency requirements
- Users may request data localization (additional fees may apply)

## 8. Data Subject Rights Support

8.1. **User's Primary Responsibility**: User is responsible for responding to data subject requests.

8.2. **Platform Assistance**: Platform provides tools and assistance for:

**Access Requests**: 
- Export functionality in Platform interface
- API access for bulk data retrieval
- Platform response time: 5 business days

**Rectification**: 
- Self-service editing in Platform interface
- Bulk update APIs for large corrections

**Erasure ("Right to be Forgotten")**:
- Deletion functionality in Platform interface
- Complete erasure within 30 days of request
- Certified deletion reports available upon request

**Portability**: 
- Data export in machine-readable format (JSON, CSV)
- Direct transfer to another platform (where technically feasible)

**Restriction**: 
- Ability to mark data for restricted processing
- Automatic enforcement of processing restrictions

**Objection**: 
- Opt-out mechanisms for direct marketing
- Objection handling workflows

8.3. **Request Fees**: Platform may charge reasonable fees for:
- Complex or voluminous requests
- Repeated requests without valid grounds
- Custom data extraction or format requests

## 9. Data Retention and Deletion

9.1. **Retention Periods**: Personal data retained:
- **Active Bookings**: Duration of storage contract + 7 years (legal requirement)
- **User Accounts**: Until account deletion requested + 90 days grace period
- **Financial Records**: 10 years (tax and legal requirement)
- **Marketing Data**: Until consent withdrawn + 30 days
- **Backups**: 90 days (then automatically deleted)

9.2. **End of Service**:
- Upon service termination, User may export all data within 90 days
- After 90 days, Platform deletes or anonymizes all personal data
- Exceptions: Legal retention obligations, backup systems (deleted per schedule)

9.3. **Deletion Certification**: Upon request, Platform provides written certification of data deletion.

9.4. **Anonymization**: As alternative to deletion, Platform may anonymize data for statistical or analytical purposes (no longer personal data).

## 10. Audits and Compliance

10.1. **Audit Rights**: User (or authorized auditor) may audit Platform's compliance:
- Upon reasonable notice (at least 30 days)
- During business hours
- No more than once per year (unless breach or supervisory authority request)
- Subject to confidentiality obligations
- At User's cost (unless audit reveals material non-compliance)

10.2. **Documentation**: Platform provides reasonable information demonstrating compliance:
- Security certifications (SOC 2, ISO 27001, etc.)
- Audit reports (summary versions)
- Compliance questionnaires
- Security documentation

10.3. **Certifications**: Platform maintains:
- ISO 27001: Information Security Management
- SOC 2 Type II: Security, Availability, Confidentiality
- PCI DSS Level 1: Payment Card Industry compliance (via Stripe)
- KVKK Registration: Registered with Turkish DPA

## 11. Data Protection Impact Assessment (DPIA)

11.1. **User's DPIA**: If User must conduct DPIA for processing involving Platform, Platform provides:
- Description of processing operations
- Purposes of processing
- Assessment of necessity and proportionality
- Assessment of risks to data subjects
- Mitigation measures implemented

11.2. **Platform Cooperation**: Platform cooperates in good faith and provides information within 15 business days.

11.3. **High-Risk Processing**: If processing is likely to result in high risk, Platform may recommend additional safeguards.

## 12. Records of Processing Activities

12.1. **Platform Records**: Platform maintains records including:
- Categories of processing carried out on behalf of each User
- Categories of data subjects and personal data
- Categories of recipients (including sub-processors)
- International data transfers and safeguards
- Security measures

12.2. **Availability**: Records made available to supervisory authorities upon request.

12.3. **User Records**: User is responsible for maintaining own records as Data Controller.

## 13. Liability and Indemnification

13.1. **Liability Allocation**: Per GDPR and KVKK:
- User liable for Controller obligations (lawfulness, data subject rights, etc.)
- Platform liable for Processor obligations (security, confidentiality, instructions, etc.)
- Each party liable only for damage caused by own non-compliance

13.2. **Indemnification**: Each party indemnifies the other against:
- Fines and penalties imposed due to own non-compliance
- Third-party claims arising from own breach of this DPA
- Costs of investigations and remediation of own breaches

13.3. **Liability Limitations**: Subject to mandatory law:
- Platform's liability limited per Terms of Service
- No liability for damages caused by User's unlawful instructions
- No liability for force majeure events

## 14. Security Incident Response

14.1. **Incident Detection**: Platform monitors for:
- Unauthorized access attempts
- Data breaches
- System vulnerabilities
- Anomalous activity

14.2. **Incident Response Plan**:
- **Detection**: Automated alerting and 24/7 monitoring
- **Assessment**: Incident severity classification within 2 hours
- **Containment**: Immediate measures to stop breach progression
- **Notification**: User notification within 48 hours
- **Investigation**: Root cause analysis
- **Remediation**: Security improvements to prevent recurrence
- **Documentation**: Incident report for regulatory compliance

14.3. **User Cooperation**: User cooperates with Platform's incident response:
- Promptly respond to Platform inquiries
- Provide information about affected data subjects
- Assist with notification to data subjects (if required)
- Participate in lessons-learned review

## 15. Terms and Termination

15.1. **Term**: This DPA remains in effect while Platform processes personal data for User.

15.2. **Termination**: DPA terminates:
- Upon termination of Platform services
- When Platform no longer processes personal data for User
- By mutual written agreement

15.3. **Effect of Termination**:
- Platform ceases processing (except for legal retention)
- Data returned or deleted per User's instructions (within 90 days)
- Sub-processor agreements terminated or data deleted
- Confidentiality obligations survive

15.4. **Survival**: Sections on liability, confidentiality, and indemnification survive termination.

## 16. Governing Law and Dispute Resolution

16.1. **Governing Law**: 
- Turkish users: Turkish law (KVKK and related regulations)
- EU users: Law of user's location (GDPR applies)

16.2. **Supervisory Authority**: Data subjects may lodge complaints with:
- Turkish Personal Data Protection Authority (KVKK Kurumu)
- Relevant EU supervisory authority (for EU data subjects)

16.3. **Jurisdiction**: Disputes resolved per Terms of Service dispute resolution provisions.

16.4. **Cooperation with Authorities**: Both parties cooperate with supervisory authorities and comply with orders and decisions.

## 17. Amendments

17.1. **DPA Updates**: Platform may update this DPA:
- To reflect changes in law or regulations
- To reflect changes in processing activities
- To improve data protection

17.2. **Notice**: Material changes communicated 60 days in advance.

17.3. **Objection**: If User objects to material changes on reasonable grounds, User may terminate services.

## 18. Contact Information

**Data Protection Officer (DPO):**
- Email: dpo@tsmart.com
- Phone: [DPO Phone]
- Address: [DPO Address]

**Privacy Team:**
- General inquiries: privacy@tsmart.com
- Data subject requests: requests@tsmart.com
- Security incidents: security@tsmart.com

**Turkish DPA:**
- Website: kvkk.gov.tr
- Application portal: https://verbis.kvkk.gov.tr

---

## Appendix A: Technical and Organizational Measures

### A.1 Access Controls
- Multi-factor authentication (MFA)
- Role-based access control (RBAC)
- Principle of least privilege
- Access logging and monitoring
- Regular access reviews

### A.2 Encryption
- Data at rest: AES-256
- Data in transit: TLS 1.3
- Database encryption
- Backup encryption
- Key management with AWS KMS / Supabase Vault

### A.3 Network Security
- Firewall protection
- Intrusion detection/prevention systems (IDS/IPS)
- DDoS protection (Cloudflare)
- Network segmentation
- VPN for administrative access

### A.4 Application Security
- Secure development lifecycle (SDLC)
- Regular security testing
- Code reviews
- Dependency scanning
- OWASP Top 10 compliance

### A.5 Operational Security
- 24/7 security monitoring
- Automated alerts
- Incident response team
- Regular security training
- Background checks for personnel

### A.6 Physical Security
- Secure data center facilities (AWS, Supabase)
- Physical access controls
- Video surveillance
- Environmental controls
- Redundant power and cooling

### A.7 Business Continuity
- Regular backups (automated daily)
- Disaster recovery plan
- Redundant infrastructure
- Failover capabilities
- RTO: 4 hours, RPO: 24 hours

### A.8 Vendor Management
- Vendor security assessments
- Contractual security requirements
- Regular vendor reviews
- Sub-processor management

---

## Appendix B: Data Processing Details

### B.1 Categories of Data Subjects
- Customers (warehouse renters)
- Warehouse owners
- Company admins and staff
- Resellers and warehouse finders
- Website visitors

### B.2 Categories of Personal Data
- Identity data: Name, email, phone, address
- Financial data: Payment information, billing address
- Technical data: IP address, browser, device info
- Usage data: Booking history, preferences, interactions
- Location data: Warehouse addresses, GPS coordinates
- Business data: Company info, tax ID, business licenses

### B.3 Sensitive Data
- Platform generally does NOT process sensitive data (health, biometric, etc.)
- If User stores sensitive data in custom fields, User must obtain explicit consent
- Additional security measures may be required for sensitive data

### B.4 Processing Purposes
- Providing Platform services (warehouse marketplace)
- Processing bookings and payments
- Customer support
- CRM and sales management
- Analytics and service improvement
- Legal compliance and dispute resolution

### B.5 Processing Duration
- See Section 9 (Data Retention and Deletion)

---

## Acceptance

By using TSmart Warehouse platform services, you acknowledge that:
- You have read and understood this Data Processing Agreement
- You accept the terms and commit to compliance
- You authorize Platform to process personal data as described

---

*This DPA is part of the TSmart Warehouse Terms of Service and should be read in conjunction with the Privacy Policy.*

*Last Updated: January 10, 2026*  
*Version: 1.0*
