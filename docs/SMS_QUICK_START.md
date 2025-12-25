# SMS Notification - Quick Start Guide

## Setup (5 minutes)

### 1. Add Environment Variables

Add to your `.env.local` file:

```env
NETGSM_USERNAME=8503023077
NETGSM_PASSWORD=2C.F26D
NETGSM_HEADER=TALYA SMART
```

### 2. Restart Your Server

```bash
npm run dev
```

---

## Usage Examples

### Option 1: Admin UI (Easiest)

1. Log in as admin
2. Navigate to **Admin** → **Notifications** → **Send SMS**
3. Choose **Single SMS** or **Bulk SMS** tab
4. Fill in phone number(s) and message
5. Click **Send SMS**

**URL**: `/admin/notifications/send-sms`

---

### Option 2: API Endpoint

#### Single SMS

```bash
curl -X POST http://localhost:3000/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "to": "5416393028",
    "message": "Your booking has been confirmed!"
  }'
```

#### Bulk SMS

```bash
curl -X POST http://localhost:3000/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "messages": [
      {"to": "5416393028", "message": "Message 1"},
      {"to": "5333333333", "message": "Message 2"}
    ]
  }'
```

---

### Option 3: Server Actions (Recommended for App)

```typescript
import { sendSMS, sendBulkSMS } from "@/features/notifications/actions"

// Single SMS
const result = await sendSMS(
  "5416393028",
  "Your booking has been confirmed!"
)

// Bulk SMS
const bulkResult = await sendBulkSMS([
  { to: "5416393028", message: "Message 1" },
  { to: "5333333333", message: "Message 2" },
])
```

---

### Option 4: Direct Provider Usage

```typescript
import { NetGSMProvider } from "@/lib/notifications/providers/sms"

const smsProvider = new NetGSMProvider()

// Single SMS
const result = await smsProvider.send({
  to: "5416393028",
  message: "Your booking has been confirmed!",
})

// Bulk SMS
const bulkResult = await smsProvider.sendBulk({
  messages: [
    { to: "5416393028", message: "Message 1" },
    { to: "5333333333", message: "Message 2" },
  ],
})
```

---

## Common Use Cases

### 1. Booking Confirmation

```typescript
import { sendBookingConfirmationSMS } from "@/features/notifications/actions"

await sendBookingConfirmationSMS(userId, {
  bookingId: "BK-12345",
  warehouseName: "Istanbul Warehouse",
  startDate: "2025-01-01",
  endDate: "2025-01-31",
})
```

### 2. Task Assignment

```typescript
import { sendTaskAssignmentSMS } from "@/features/notifications/actions"

await sendTaskAssignmentSMS(userId, {
  taskId: "TSK-789",
  taskTitle: "Load pallets to Zone A",
  dueDate: "2025-01-15",
})
```

### 3. Invoice Reminder

```typescript
import { sendInvoiceReminderSMS } from "@/features/notifications/actions"

await sendInvoiceReminderSMS(userId, {
  invoiceNumber: "INV-2025-001",
  amount: "5000",
  dueDate: "2025-01-20",
})
```

---

## Phone Number Format

✅ **Correct Formats** (all work):
- `5416393028` (preferred)
- `05416393028`
- `905416393028`
- `+905416393028`

❌ **Incorrect Formats**:
- `416393028` (missing leading 5)
- `123456789` (not a valid Turkish mobile)

---

## Message Guidelines

- **Max Length**: 160 characters
- **Encoding**: Turkish characters supported (ç, ğ, ı, ö, ş, ü)
- **Sender**: Must be registered with NetGSM (max 11 chars)

---

## Testing

### Test Single SMS

```typescript
import { testSingleSMS } from "@/lib/notifications/providers/sms.test"

await testSingleSMS()
```

### Test Bulk SMS

```typescript
import { testBulkSMS } from "@/lib/notifications/providers/sms.test"

await testBulkSMS()
```

---

## Troubleshooting

### SMS Not Sending?

1. ✅ Check environment variables are set
2. ✅ Verify NetGSM credentials are correct
3. ✅ Check NetGSM account balance
4. ✅ Ensure sender name is registered
5. ✅ Verify phone number format

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 00 | Success | ✅ All good |
| 01 | Invalid credentials | Check username/password |
| 02 | Insufficient balance | Add credits to NetGSM |
| 20 | Invalid header | Register sender name |
| 30 | Invalid phone | Check phone format |

---

## Need Help?

- 📖 Full Documentation: `docs/SMS_NOTIFICATION_SETUP.md`
- 🔧 Test Utilities: `lib/notifications/providers/sms.test.ts`
- 🎨 Admin UI: `/admin/notifications/send-sms`
- 🔌 API Endpoint: `/api/v1/notifications/sms`

---

**Last Updated**: December 25, 2025  
**Version**: 1.0.0

