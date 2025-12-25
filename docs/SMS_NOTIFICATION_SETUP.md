# SMS Notification Setup - NetGSM Integration

## Overview

TSmart Warehouse now supports SMS notifications using **NetGSM**, a leading Turkish SMS service provider. This integration allows sending both single and bulk SMS messages for various notifications like booking confirmations, task assignments, and invoice reminders.

---

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# NetGSM SMS Configuration
NETGSM_USERNAME=8503023077
NETGSM_PASSWORD=2C.F26D
NETGSM_HEADER=TALYA SMART
```

### Variable Descriptions

- **NETGSM_USERNAME**: Your NetGSM account username (provided by NetGSM)
- **NETGSM_PASSWORD**: Your NetGSM account password (provided by NetGSM)
- **NETGSM_HEADER**: SMS sender name (must be registered with NetGSM, max 11 characters)

---

## API Endpoint

### POST `/api/v1/notifications/sms`

Send SMS notification(s) to one or multiple recipients.

#### Authentication

- Requires valid user session
- Only users with **admin** role can send SMS

#### Request Body - Single SMS

```json
{
  "to": "5416393028",
  "message": "Your booking has been confirmed. Booking ID: #12345",
  "from": "TALYA SMART"
}
```

#### Request Body - Bulk SMS

```json
{
  "messages": [
    {
      "to": "5416393028",
      "message": "Test message 1"
    },
    {
      "to": "5333333333",
      "message": "Test message 2"
    }
  ],
  "from": "TALYA SMART"
}
```

#### Response - Success

```json
{
  "success": true,
  "message": "SMS sent successfully",
  "messageId": "1234567890"
}
```

#### Response - Bulk Success

```json
{
  "success": true,
  "message": "Bulk SMS sent successfully",
  "results": [
    {
      "to": "5416393028",
      "success": true,
      "messageId": "1234567890"
    },
    {
      "to": "5333333333",
      "success": true,
      "messageId": "1234567891"
    }
  ]
}
```

#### Response - Error

```json
{
  "error": "Failed to send SMS",
  "details": "NetGSM error code: 02 - Insufficient balance"
}
```

---

## Usage Examples

### 1. Using the API Endpoint (cURL)

```bash
# Single SMS
curl -X POST https://your-domain.com/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "to": "5416393028",
    "message": "Your booking has been confirmed!"
  }'

# Bulk SMS
curl -X POST https://your-domain.com/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "messages": [
      {"to": "5416393028", "message": "Message 1"},
      {"to": "5333333333", "message": "Message 2"}
    ]
  }'
```

### 2. Using the SMS Provider Directly (Server-Side)

```typescript
import { NetGSMProvider } from "@/lib/notifications/providers/sms"

// Initialize provider
const smsProvider = new NetGSMProvider()

// Send single SMS
const result = await smsProvider.send({
  to: "5416393028",
  message: "Your booking has been confirmed!",
})

console.log(result)
// { success: true, messageId: "1234567890" }

// Send bulk SMS
const bulkResult = await smsProvider.sendBulk({
  messages: [
    { to: "5416393028", message: "Message 1" },
    { to: "5333333333", message: "Message 2" },
  ],
})

console.log(bulkResult)
// { success: true, results: [...] }
```

### 3. Using the Notification Service

The SMS provider is integrated into the main notification service:

```typescript
import { getNotificationService } from "@/lib/notifications"

const notificationService = getNotificationService()

// Send notification via SMS channel
await notificationService.sendNotification({
  userId: "user-id",
  type: "booking",
  channels: ["sms"],
  title: "Booking Confirmed",
  message: "Your booking #12345 has been confirmed.",
})
```

---

## Phone Number Format

NetGSM expects phone numbers in the following format:

- **Format**: `5XXXXXXXXX` (10 digits, starting with 5)
- **Example**: `5416393028`

The provider automatically handles the following formats:

- `5416393028` ✅ (preferred)
- `05416393028` ✅ (removes leading 0)
- `905416393028` ✅ (removes country code)
- `+905416393028` ✅ (removes + and country code)

---

## Message Encoding

- **Encoding**: `TR` (Turkish character support)
- **Max Length**: 160 characters per SMS
- **Supported Characters**: Turkish characters (ç, ğ, ı, ö, ş, ü)

If your message exceeds 160 characters, it will be split into multiple SMS messages.

---

## NetGSM Response Codes

| Code | Description |
|------|-------------|
| 00 | Success |
| 01 | Invalid username or password |
| 02 | Insufficient balance |
| 20 | Invalid message header |
| 30 | Invalid phone number |
| 40 | Message header not defined |
| 50 | System error |
| 51 | Invalid encoding |
| 70 | Invalid parameters |
| 85 | Invalid phone number format |

---

## Testing

### Test Scripts

Use the provided test utilities to verify SMS functionality:

```typescript
import {
  testSingleSMS,
  testBulkSMS,
  sendBookingConfirmationSMS,
  sendTaskAssignmentSMS,
  sendInvoiceReminderSMS,
} from "@/lib/notifications/providers/sms.test"

// Test single SMS
await testSingleSMS()

// Test bulk SMS
await testBulkSMS()

// Send booking confirmation
await sendBookingConfirmationSMS("5416393028", {
  bookingId: "BK-12345",
  warehouseName: "Istanbul Warehouse",
  startDate: "2025-01-01",
  endDate: "2025-01-31",
})
```

### Manual Testing via API

1. Start your development server
2. Log in as an admin user
3. Use the API endpoint to send test SMS:

```bash
curl -X POST http://localhost:3000/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5416393028",
    "message": "Test SMS from TSmart Warehouse"
  }'
```

---

## Integration Points

SMS notifications are automatically sent for the following events:

### 1. Booking Events
- ✅ Booking confirmed
- ✅ Booking cancelled
- ✅ Booking reminder (24 hours before)

### 2. Task Events
- ✅ Task assigned
- ✅ Task due soon
- ✅ Task completed

### 3. Invoice Events
- ✅ Invoice created
- ✅ Payment received
- ✅ Payment overdue

### 4. Incident Events
- ✅ Incident reported
- ✅ Incident resolved
- ✅ Incident escalated

### 5. System Events
- ✅ Account verification
- ✅ Password reset
- ✅ Security alerts

---

## User Preferences

Users can control SMS notifications in their settings:

1. Navigate to **Settings** → **Notifications**
2. Toggle SMS notifications on/off
3. Configure per-event SMS preferences
4. Update phone number for SMS delivery

---

## Security Considerations

1. **Authentication**: Only authenticated admin users can send SMS
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Audit Logging**: All SMS sends are logged in `audit_logs` table
4. **Phone Validation**: Phone numbers are validated before sending
5. **Message Length**: Messages are limited to 160 characters

---

## Cost Considerations

- Each SMS costs according to NetGSM pricing
- Bulk SMS may have volume discounts
- Monitor your NetGSM balance regularly
- Set up low balance alerts in NetGSM dashboard

---

## Troubleshooting

### SMS Not Sending

1. **Check credentials**: Verify `NETGSM_USERNAME` and `NETGSM_PASSWORD`
2. **Check balance**: Ensure sufficient balance in NetGSM account
3. **Check header**: Verify `NETGSM_HEADER` is registered with NetGSM
4. **Check phone format**: Ensure phone number is in correct format
5. **Check logs**: Review server logs for error messages

### Invalid Phone Number

- Ensure phone number starts with 5 (Turkish mobile)
- Remove country code (90) and leading 0
- Use 10-digit format: `5XXXXXXXXX`

### Insufficient Balance

- Log in to NetGSM dashboard
- Check account balance
- Add credits to your account

### Message Not Delivered

- Check if recipient's phone is active
- Verify phone number is correct
- Check NetGSM delivery reports

---

## Support

For NetGSM-specific issues:
- **Website**: https://www.netgsm.com.tr
- **Support**: support@netgsm.com.tr
- **Documentation**: https://www.netgsm.com.tr/dokuman/

For TSmart Warehouse integration issues:
- Check server logs
- Review audit logs in database
- Contact development team

---

## Future Enhancements

- [ ] SMS templates for common notifications
- [ ] Scheduled SMS sending
- [ ] SMS delivery status tracking
- [ ] SMS analytics and reporting
- [ ] Two-way SMS communication
- [ ] SMS opt-in/opt-out management
- [ ] IYS (İleti Yönetim Sistemi) integration
- [ ] Multiple SMS provider support (failover)

---

**Last Updated**: December 25, 2025  
**Version**: 1.0.0  
**Maintained By**: TSmart Warehouse Development Team

