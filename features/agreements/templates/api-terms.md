# API Terms of Use

**Effective Date:** January 10, 2026  
**Version:** 1.0

## 1. Agreement Overview

These API Terms of Use ("API Terms") govern your access to and use of the TSmart Warehouse Application Programming Interface ("API"). By accessing or using the API, you agree to these API Terms, which supplement the Platform Terms of Service.

## 2. API Access

2.1. **Registration**: To use the API:
- Create a TSmart Warehouse account
- Generate API credentials in your account dashboard
- Accept these API Terms
- Maintain current account and billing information

2.2. **API Credentials**:
- **API Key**: Unique identifier for your application
- **Secret Key**: Private authentication token (never share or expose)
- **Webhook Secret**: For verifying webhook signatures

2.3. **Credential Security**: You must:
- Keep credentials confidential and secure
- Never commit credentials to public repositories
- Use environment variables or secure key management
- Rotate keys if compromised
- Report compromised credentials immediately to api@tsmart.com

## 3. Acceptable API Usage

3.1. **Authorized Uses**:
- Build applications that integrate with TSmart Warehouse
- Automate warehouse search and booking workflows
- Sync data between TSmart and your systems
- Create custom reporting and analytics
- Develop mobile or desktop applications

3.2. **Rate Limits**:

| Tier | Requests/Hour | Burst Limit |
|------|---------------|-------------|
| **Free** | 1,000 | 100/minute |
| **Standard** | 10,000 | 500/minute |
| **Premium** | 100,000 | 2,000/minute |
| **Enterprise** | Custom | Custom |

3.3. **Rate Limit Headers**: API responses include:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1704067200
```

3.4. **Exceeding Limits**:
- HTTP 429 (Too Many Requests) returned
- Retry-After header indicates wait time
- Repeated violations may result in temporary suspension
- Contact api@tsmart.com to discuss limit increases

## 4. Prohibited API Usage

4.1. **You May NOT**:
- Scrape or harvest data beyond your authorized access
- Build competing warehouse marketplace platforms
- Resell or redistribute API access
- Circumvent rate limits or security measures
- Use API for illegal purposes
- Attempt to reverse engineer the API
- Overload or attack API infrastructure
- Access other users' data without permission
- Use API to send spam or malicious content

4.2. **Data Mining Restrictions**:
- No systematic downloading of Platform data
- No creation of derivative databases
- No aggregation for competing services
- Analytics only for your authorized business purposes

## 5. API Endpoints and Functionality

5.1. **Available Endpoints**:
- **Warehouses**: Search, list, retrieve details
- **Bookings**: Create, read, update, cancel
- **Payments**: Create payment intents, retrieve status
- **Users**: Retrieve profile, update settings
- **CRM**: Manage contacts, activities, pipeline (for authorized roles)
- **Webhooks**: Receive real-time event notifications

5.2. **API Documentation**: Complete documentation at: https://api.tsmart.com/docs

5.3. **API Versioning**:
- Current version: v1
- Version specified in URL: `/api/v1/`
- Backward compatibility maintained for 12 months
- New versions announced 6 months in advance
- Deprecated endpoints supported for 12 months

## 6. Authentication and Authorization

6.1. **Authentication Methods**:

**API Key Authentication**:
```
Authorization: Bearer YOUR_API_KEY
```

**OAuth 2.0** (for user-authorized apps):
- Authorization Code flow for web apps
- Client Credentials flow for server-to-server
- Refresh tokens for long-lived access

6.2. **Permissions and Scopes**:
- `read:warehouses` - Read warehouse listings
- `write:bookings` - Create and manage bookings
- `read:profile` - Access user profile
- `write:profile` - Update user settings
- `read:crm` - Access CRM data
- `write:crm` - Manage CRM records

6.3. **Role-Based Access**: API access respects user roles:
- Customers: Limited to own bookings and public warehouse data
- Warehouse Owners: Access to own listings and bookings
- Resellers/Finders: CRM access per partnership agreement
- Admins: Elevated permissions as appropriate

## 7. Data Handling and Privacy

7.1. **Data Access**: You may only access:
- Data you own or create
- Public data (warehouse listings)
- Data explicitly shared with you
- Data for which you have user authorization

7.2. **Data Usage**: You must:
- Comply with KVKK and GDPR
- Use data only for authorized purposes
- Implement appropriate security measures
- Respect user privacy and preferences
- Delete data when no longer needed or upon user request

7.3. **Data Protection Agreement**: API usage is subject to the Platform's Data Processing Agreement (DPA).

7.4. **Personal Data**: Handle personal data with care:
- Minimize data collection
- Encrypt data in transit and at rest
- Implement access controls
- Log and monitor data access
- Respond promptly to data subject requests

## 8. Webhooks

8.1. **Webhook Events**:
- `booking.created` - New booking created
- `booking.confirmed` - Booking confirmed
- `booking.cancelled` - Booking cancelled
- `payment.succeeded` - Payment processed
- `payment.failed` - Payment failed
- `warehouse.updated` - Warehouse details changed

8.2. **Webhook Configuration**:
- Configure endpoints in your account dashboard
- HTTPS required for webhook URLs
- Verify webhook signatures:
```javascript
const signature = req.headers['x-tsmart-signature'];
const isValid = verifySignature(req.body, signature, webhookSecret);
```

8.3. **Webhook Delivery**:
- Retry up to 3 times with exponential backoff
- Must respond with 2xx status within 5 seconds
- Failed webhooks logged in dashboard
- Disabled after 7 consecutive failures

8.4. **Webhook Security**:
- Always verify signatures
- Use HTTPS only
- Validate event data
- Implement idempotency (handle duplicate events)

## 9. API Response Formats

9.1. **Request Format**:
```
Content-Type: application/json
Accept: application/json
```

9.2. **Success Response** (2xx):
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-10T10:00:00Z",
    "request_id": "req_123abc"
  }
}
```

9.3. **Error Response** (4xx, 5xx):
```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Invalid booking date",
    "details": [ ... ]
  },
  "meta": {
    "request_id": "req_123abc"
  }
}
```

9.4. **Pagination**:
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "page": 2,
    "per_page": 20,
    "total_pages": 8
  }
}
```

## 10. Error Handling

10.1. **HTTP Status Codes**:
- `200 OK` - Request successful
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid or missing credentials
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Temporary outage or maintenance

10.2. **Retry Logic**: Implement exponential backoff:
```
First retry: 1 second
Second retry: 2 seconds
Third retry: 4 seconds
Max retries: 3
```

10.3. **Error Codes**:
- `invalid_request` - Malformed request
- `authentication_error` - Credentials invalid
- `permission_denied` - Insufficient permissions
- `resource_not_found` - Resource doesn't exist
- `rate_limit_exceeded` - Too many requests
- `validation_error` - Data validation failed
- `server_error` - Internal error

## 11. Testing and Development

11.1. **Sandbox Environment**:
- Available at: https://sandbox.api.tsmart.com
- Test data and accounts
- No real transactions
- Same API structure as production

11.2. **Test Credentials**:
- Generate sandbox API keys in dashboard
- Clearly labeled "Test" mode
- Separate from production credentials

11.3. **Test Payment Methods**:
- Test card numbers provided in documentation
- No real charges processed in sandbox
- Simulate different payment scenarios

## 12. API Performance and Reliability

12.1. **SLA**: API covered by Platform SLA:
- 99.9% uptime guarantee
- < 500ms median response time
- < 2 seconds 99th percentile response time

12.2. **Monitoring**: Monitor API health:
- Status page: status.tsmart.com
- Incident notifications
- Performance metrics

12.3. **Best Practices**:
- Cache responses where appropriate
- Use pagination for large datasets
- Implement request timeouts (30 seconds recommended)
- Handle errors gracefully
- Log requests for debugging

## 13. Intellectual Property

13.1. **Platform IP**: Platform retains all rights to:
- API design and implementation
- API documentation
- TSmart trademarks and branding

13.2. **Your IP**: You retain rights to:
- Your application code
- Your business logic
- Your user interfaces

13.3. **License Grant**: Platform grants you a limited, non-exclusive, non-transferable license to use the API for authorized purposes.

13.4. **Attribution**: If your application is public-facing:
- Include "Powered by TSmart Warehouse" attribution
- Use approved logos and branding per brand guidelines

## 14. Application Requirements

14.1. **Quality Standards**: Your application must:
- Function reliably and as described
- Handle errors gracefully
- Respect user privacy
- Comply with applicable laws
- Not misrepresent Platform or services

14.2. **Security Requirements**:
- Use HTTPS for all communications
- Implement proper authentication
- Protect user data
- Report security vulnerabilities: security@tsmart.com
- Follow secure coding practices

14.3. **App Review**: Platform may review applications:
- For compliance with these Terms
- For security and quality
- Before featuring or partnership opportunities

## 15. Fees and Billing

15.1. **API Tiers**:

**Free Tier**:
- 1,000 requests/hour
- Community support
- Sandbox access
- Suitable for development and testing

**Standard Tier** ($99/month):
- 10,000 requests/hour
- Email support
- Production access
- Suitable for small businesses

**Premium Tier** ($499/month):
- 100,000 requests/hour
- Priority support
- Advanced features
- Suitable for growing businesses

**Enterprise Tier** (Custom pricing):
- Custom rate limits
- Dedicated support
- SLA guarantees
- Custom integrations

15.2. **Overage Fees**: Exceeding tier limits:
- $0.01 per additional API call
- Billed monthly in arrears
- Consider upgrading tier for better value

15.3. **Transaction Fees**: Standard Platform transaction fees apply to bookings created via API.

## 16. Support and Documentation

16.1. **Resources**:
- API Documentation: https://api.tsmart.com/docs
- API Status: status.tsmart.com
- GitHub Examples: github.com/tsmart/api-examples
- Postman Collection: Available for download

16.2. **Support Channels**:
- **Email**: api@tsmart.com
- **Developer Forum**: forum.tsmart.com
- **Live Chat**: For Premium/Enterprise (business hours)
- **Phone**: Enterprise customers only

16.3. **Response Times**:
- Free Tier: 48 hours (community support)
- Standard Tier: 24 hours (business days)
- Premium Tier: 4 hours (business hours)
- Enterprise Tier: 1 hour (24/7)

## 17. Changes and Deprecation

17.1. **Breaking Changes**:
- 6 months advance notice
- Migration guide provided
- Old version supported for 12 months
- Automatic notifications to registered developers

17.2. **Non-Breaking Changes**:
- May be deployed without notice
- Additive features (new endpoints, optional parameters)
- Bug fixes and performance improvements

17.3. **Deprecation Process**:
- Endpoint marked as deprecated in documentation
- Warning headers in API responses
- Migration guide published
- 12-month sunset period
- Final shutdown date communicated

## 18. Termination

18.1. **Termination by You**:
- Delete API credentials in dashboard
- No refunds for prepaid tiers (partial month)
- Data export available for 90 days

18.2. **Termination by Platform**:
- For violation of these Terms
- For non-payment
- For abuse or security concerns
- With 30 days notice for convenience

18.3. **Effect of Termination**:
- API access immediately revoked
- Outstanding fees due immediately
- No refunds for prepaid services
- Backup and export your data before termination

## 19. Liability and Warranties

19.1. **API "As-Is"**: API provided without warranties:
- No guarantee of uninterrupted service
- No guarantee of error-free operation
- No guarantee of specific features or availability

19.2. **Limitation of Liability**: Platform liability limited to:
- Lesser of: fees paid in past 12 months or $1,000
- No liability for indirect or consequential damages

19.3. **Your Responsibility**: You are responsible for:
- Your application's functionality and reliability
- Your handling of user data
- Your compliance with laws and regulations
- Backup of your data

## 20. Legal and Compliance

20.1. **Governing Law**: Turkish law governs these Terms.

20.2. **Compliance**: You must comply with:
- Export control laws
- Data protection regulations (KVKK, GDPR)
- Payment card industry standards (PCI DSS)
- Other applicable laws

20.3. **Entire Agreement**: These API Terms, together with Platform Terms of Service, constitute the entire agreement.

## 21. Contact Information

**API Support:**
- Email: api@tsmart.com
- Documentation: https://api.tsmart.com/docs
- Status Page: status.tsmart.com

**Developer Relations:**
- Email: developers@tsmart.com
- Forum: forum.tsmart.com

**Security:**
- Email: security@tsmart.com
- Bug Bounty: https://tsmart.com/security/bounty

---

## Quick Start Example

```javascript
// Initialize API client
const tsmart = require('@tsmart/api-client');
const client = tsmart.createClient({
  apiKey: process.env.TSMART_API_KEY
});

// Search warehouses
const warehouses = await client.warehouses.search({
  city: 'Istanbul',
  min_size: 1000,
  available_from: '2026-02-01'
});

// Create booking
const booking = await client.bookings.create({
  warehouse_id: warehouses[0].id,
  start_date: '2026-02-01',
  end_date: '2026-05-01',
  pallet_count: 50
});

// Handle webhook
app.post('/webhooks/tsmart', (req, res) => {
  const signature = req.headers['x-tsmart-signature'];
  if (!client.webhooks.verify(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = req.body;
  if (event.type === 'booking.confirmed') {
    // Handle booking confirmation
  }
  
  res.status(200).send('OK');
});
```

---

## Acceptance

By using the TSmart Warehouse API, you acknowledge that you have read, understood, and agree to these API Terms of Use.

---

*Last Updated: January 10, 2026*  
*Version: 1.0*

*For questions about API usage or to request enterprise features, contact api@tsmart.com*
