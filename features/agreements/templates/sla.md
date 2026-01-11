# Service Level Agreement (SLA)

**Effective Date:** January 10, 2026  
**Version:** 1.0

## 1. Agreement Overview

This Service Level Agreement ("SLA") defines the level of service expected from TSmart Warehouse ("Platform") for its marketplace platform services. This SLA applies to all users of the Platform.

## 2. Service Availability

2.1. **Uptime Commitment**:
- **Target Uptime**: 99.9% monthly uptime
- **Measurement Period**: Calendar month
- **Planned Maintenance**: Excluded from uptime calculation

2.2. **Uptime Calculation**:
```
Uptime % = (Total Minutes in Month - Downtime Minutes) / Total Minutes in Month × 100
```

2.3. **Downtime Definition**: Periods when Platform is unavailable and users cannot:
- Access their accounts
- Create or view bookings
- Process payments
- Access essential Platform features

2.4. **Exclusions from Downtime**:
- Scheduled maintenance (announced 72 hours in advance)
- Emergency security patches
- Force majeure events
- Third-party service failures (beyond Platform's control)
- Issues caused by user's internet connection or equipment
- DDoS attacks or other malicious activities
- User's violation of Terms of Service

## 3. Scheduled Maintenance

3.1. **Maintenance Windows**:
- **Standard Maintenance**: Sundays, 2:00 AM - 6:00 AM (Turkish Time)
- **Frequency**: Up to 2 times per month
- **Duration**: Maximum 4 hours per maintenance window

3.2. **Advance Notice**:
- **Standard Maintenance**: 72 hours notice via email and Platform banner
- **Emergency Maintenance**: As soon as reasonably possible, typically 4-24 hours
- **Critical Security Updates**: May be applied immediately with retrospective notice

3.3. **Extended Maintenance**: If maintenance requires more than 4 hours:
- At least 14 days advance notice
- Scheduled during lowest-usage periods
- Detailed explanation provided

## 4. Performance Standards

4.1. **Response Time**:
- **Page Load**: Average 2 seconds for 95% of requests
- **API Responses**: 500ms median, 2 seconds for 99th percentile
- **Search Results**: Within 3 seconds

4.2. **Transaction Processing**:
- **Booking Confirmation**: Within 5 seconds
- **Payment Processing**: Within 10 seconds (excluding bank processing)
- **Email Notifications**: Within 5 minutes of trigger event

4.3. **Data Backup**:
- **Frequency**: Automated daily backups
- **Retention**: 90 days
- **Backup Testing**: Monthly verification of restore capability
- **Recovery Point Objective (RPO)**: 24 hours
- **Recovery Time Objective (RTO)**: 4 hours

## 5. Support Response Times

5.1. **Support Channels**:
- Email support: support@tsmart.com
- Phone support: [Phone Number] (business hours)
- In-app chat: Available during business hours
- Help center: 24/7 self-service

5.2. **Business Hours**: Monday-Friday, 9:00 AM - 6:00 PM (Turkish Time), excluding public holidays

5.3. **Response Times by Priority**:

| Priority Level | Description | First Response | Resolution Target |
|---------------|-------------|----------------|-------------------|
| **Critical** | Platform down, major functionality unavailable | 1 hour | 4 hours |
| **High** | Major feature impaired, significant user impact | 4 hours | 24 hours |
| **Medium** | Minor feature issue, workaround available | 12 hours | 72 hours |
| **Low** | General question, minor issue, feature request | 24 hours | 5 business days |

5.4. **Priority Definitions**:

**Critical (P1)**:
- Platform completely inaccessible
- Payment processing failures
- Data loss or corruption
- Security breach

**High (P2)**:
- Major feature not working (search, booking, dashboard)
- Intermittent platform availability
- Significant performance degradation
- Issue affecting multiple users

**Medium (P3)**:
- Minor feature malfunction
- Cosmetic issues affecting usability
- Non-critical errors
- Issues with workarounds available

**Low (P4)**:
- General inquiries
- Feature requests
- Documentation questions
- Minor cosmetic issues

5.5. **Escalation**: If issue not resolved within target time:
- Automatic escalation to senior support engineer
- Email notification to user
- Priority re-assessment
- Management involvement for Critical issues

## 6. Security Standards

6.1. **Data Protection**:
- Encryption in transit: TLS 1.3
- Encryption at rest: AES-256
- Regular security audits: Quarterly
- Penetration testing: Bi-annually

6.2. **Access Control**:
- Multi-factor authentication (MFA) available
- Role-based access control (RBAC)
- Session management and timeouts
- Audit logging of sensitive actions

6.3. **Compliance**:
- KVKK (Turkish Personal Data Protection Law)
- GDPR (for EU data subjects)
- PCI DSS Level 1 (via payment processor)
- ISO 27001 certification

6.4. **Security Incident Response**:
- Detection and containment: Within 2 hours
- User notification: Within 48 hours
- Incident report: Within 10 business days
- Remediation plan: Within 30 days

## 7. Service Credits

7.1. **Credit Eligibility**: If monthly uptime falls below commitment:

| Monthly Uptime | Service Credit |
|----------------|----------------|
| 99.0% - 99.9% | 10% of monthly fees |
| 95.0% - 99.0% | 25% of monthly fees |
| Below 95.0% | 50% of monthly fees |

7.2. **Credit Calculation**:
- Based on user's monthly subscription fee
- For transaction-based users: Average of prior 3 months
- Maximum credit: 50% of monthly fees
- Credits applied to next month's invoice

7.3. **Claiming Credits**:
- User must request within 30 days of incident
- Request via email to billing@tsmart.com
- Include: Account details, dates/times of downtime, description of impact
- Platform verifies claim against monitoring data
- Credits issued within 30 days of approved claim

7.4. **Limitations**:
- Credits are user's sole remedy for SLA breach
- Credits only for verified downtime exceeding allowance
- No credits for scheduled maintenance or excluded events
- Credits not redeemable for cash

## 8. Monitoring and Reporting

8.1. **Status Page**: Real-time status dashboard at status.tsmart.com showing:
- Current system status
- Recent incidents
- Scheduled maintenance
- Historical uptime statistics

8.2. **Incident Communication**:
- Real-time updates during incidents
- Estimated resolution time
- Workarounds (if available)
- Post-incident reports

8.3. **Performance Reports**: Monthly reports available to enterprise customers:
- Uptime percentage
- Average response times
- Support ticket statistics
- System performance metrics

8.4. **Third-Party Monitoring**: Platform uses independent monitoring services to verify uptime claims.

## 9. Service Tiers

9.1. **Standard Tier** (Included for all users):
- 99.9% uptime SLA
- Standard support response times
- Access to all core Platform features
- Email and in-app support
- Help center and documentation

9.2. **Enterprise Tier** (For large organizations):
- 99.95% uptime SLA
- Priority support (faster response times)
- Dedicated account manager
- Phone support with priority queue
- Custom SLA available
- Monthly performance reports
- Quarterly business reviews

9.3. **Custom SLA**: Enterprise customers may negotiate:
- Higher uptime guarantees
- Faster response times
- Extended support hours (24/7 options)
- Dedicated infrastructure
- Custom backup and recovery requirements

## 10. Third-Party Dependencies

10.1. **Critical Dependencies**: Platform relies on:
- **Supabase**: Database and authentication (99.9% SLA)
- **Stripe**: Payment processing (99.99% SLA)
- **Vercel**: Hosting and CDN (99.99% SLA)
- **AWS**: Cloud infrastructure (99.99% SLA)
- **SendGrid**: Email delivery (99.95% SLA)

10.2. **Dependency Impact**: If third-party service causes downtime:
- Platform not liable for third-party failures
- Platform works to mitigate impact
- Platform provides updates and workarounds
- Platform pursues service credits from vendor and may pass to users

10.3. **Redundancy**: Platform implements:
- Multi-region deployment for critical services
- Failover mechanisms for database and API
- CDN for improved availability
- Redundant payment processing options

## 11. Disaster Recovery and Business Continuity

11.1. **Disaster Recovery Plan**:
- Documented procedures for major incidents
- Regular DR drills (quarterly)
- Off-site backups in multiple geographic regions
- Clear escalation paths and communication plans

11.2. **Data Recovery**:
- **RPO (Recovery Point Objective)**: 24 hours (maximum data loss)
- **RTO (Recovery Time Objective)**: 4 hours (maximum downtime)
- Automated failover for database
- Point-in-time recovery capability

11.3. **Business Continuity**: In event of catastrophic failure:
- Communication to all users within 2 hours
- Status updates every 4 hours
- Estimated recovery timeline provided
- Alternative access methods if available

## 12. Performance Optimization

12.1. **Continuous Improvement**: Platform commits to:
- Regular performance audits
- Optimization based on user feedback
- Infrastructure scaling as needed
- Proactive monitoring and issue detection

12.2. **Capacity Planning**:
- Regular capacity reviews
- Advance planning for traffic growth
- Load testing before major features
- Scaling infrastructure ahead of demand

12.3. **User Feedback**: Platform actively seeks feedback on:
- Performance issues
- Feature reliability
- Support quality
- SLA effectiveness

## 13. Limitations and Exclusions

13.1. **No SLA Coverage**: This SLA does NOT cover:
- Beta or preview features (marked as such)
- Free trial accounts (best effort support)
- Deprecated features (with 90 days notice)
- Third-party integrations not controlled by Platform
- Mobile apps (separate mobile SLA)

13.2. **Force Majeure**: Platform not liable for delays or failures due to:
- Natural disasters, wars, terrorism
- Government actions, laws, regulations
- Strikes, labor disputes
- Internet infrastructure failures
- Cyber attacks beyond Platform's control

13.3. **User Responsibility**: SLA does not apply to issues caused by:
- User's internet connection or equipment
- User's browsers, devices, or software
- User actions that violate Terms of Service
- User's failure to follow Platform guidelines
- User's custom integrations or code

## 14. SLA Modifications

14.1. **Changes**: Platform may modify this SLA:
- To reflect service improvements
- To adjust targets based on infrastructure changes
- To comply with legal or regulatory requirements

14.2. **Notice**: Material changes communicated 60 days in advance via:
- Email notification
- Platform banner announcement
- Blog post on website
- Updated SLA version with change log

14.3. **User Rights**: If changes materially reduce service levels:
- Enterprise customers may renegotiate
- All users may terminate services without penalty

## 15. Measurement and Verification

15.1. **Monitoring Tools**:
- Uptime Robot: External uptime monitoring
- Datadog: Application performance monitoring
- Custom health checks: Internal service monitoring
- User-reported issues: Verified and tracked

15.2. **Data Retention**: Monitoring data retained for:
- Real-time dashboards: 30 days
- Historical reports: 2 years
- Incident reports: 5 years (compliance)

15.3. **Dispute Resolution**: If user disputes uptime calculation:
- User submits evidence within 30 days
- Platform reviews monitoring data
- Independent third-party verification if needed
- Resolution within 15 business days

## 16. Support SLA Details

16.1. **Support Hours**:
- **Email Support**: 24/7 (response during business hours)
- **Phone Support**: Business hours only
- **Emergency Hotline**: 24/7 for Critical (P1) issues
- **Chat Support**: Business hours only

16.2. **Support Languages**:
- Turkish: Full support
- English: Full support
- Other languages: Best effort, may use translation tools

16.3. **Support Quality Standards**:
- First Contact Resolution (FCR): 70% target for P3/P4 issues
- Customer Satisfaction (CSAT): 90% target
- Average Handle Time: 15 minutes for standard issues
- Ticket backlog: 100% of tickets acknowledged within SLA

## 17. Enterprise Support Add-ons

17.1. **Dedicated Account Manager**:
- Single point of contact
- Monthly check-ins
- Proactive issue identification
- Custom reporting

17.2. **Priority Support Queue**:
- Immediate escalation
- Named support engineers
- Direct phone line
- After-hours support (optional)

17.3. **Technical Account Management**:
- Architectural guidance
- Integration support
- Performance optimization consulting
- Custom training sessions

## 18. SLA Governance

18.1. **Review Schedule**: This SLA is reviewed:
- Quarterly: Internal performance review
- Semi-annually: Customer feedback incorporation
- Annually: Comprehensive revision

18.2. **Stakeholder Input**: Platform seeks input from:
- Enterprise customers
- User advisory board
- Support team feedback
- Industry benchmarks

18.3. **Continuous Improvement**: Platform commits to:
- Increasing uptime targets over time
- Reducing response times
- Expanding support coverage
- Adding new features to improve reliability

## 19. Contact Information

**SLA Inquiries:**
- Email: sla@tsmart.com
- Phone: [Phone Number]

**Support:**
- Email: support@tsmart.com
- Phone: [Support Phone]
- Emergency Hotline: [24/7 Hotline]

**Status Updates:**
- Status Page: status.tsmart.com
- Twitter: @TSmartStatus
- Email Alerts: Subscribe via account settings

## 20. Legal and Compliance

20.1. **Binding Agreement**: This SLA is a binding part of the Terms of Service.

20.2. **Liability**: Platform's liability limited per Terms of Service. Service credits are user's sole remedy for SLA breach.

20.3. **Jurisdiction**: Disputes governed by Terms of Service provisions.

20.4. **Survival**: SLA obligations survive termination for any claims arising during service period.

---

## Service Credit Request Form

To request service credits for SLA breach:

**User Information:**
- Account Name: _______________
- Contact Email: _______________
- Account ID: _______________

**Incident Details:**
- Date(s) of Downtime: _______________
- Time Period: _______________ to _______________
- Description of Issue: _______________
- Impact on Business: _______________

**Claimed Downtime**: _______ minutes

**Supporting Evidence:**
- Screenshots: [ ]
- Error messages: [ ]
- Communication records: [ ]

Submit to: billing@tsmart.com within 30 days of incident.

---

## Appendix A: Service History

**Historical Uptime (Last 12 Months):**
- January 2026: 99.95%
- [Previous months to be updated monthly]

**Major Incidents (Last 12 Months):**
- None reported

**Planned Maintenance:**
- Total Hours: [X] hours
- Average per Month: [Y] hours

---

## Acceptance

By using TSmart Warehouse platform, you acknowledge and accept this Service Level Agreement.

For questions about SLA coverage or to discuss enterprise-level SLAs, contact our sales team at enterprise@tsmart.com.

---

*Last Updated: January 10, 2026*  
*Version: 1.0*

*This SLA is reviewed quarterly and updated as needed to reflect service improvements and user needs.*
