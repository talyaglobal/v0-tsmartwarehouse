# 📱 SMS Notification System

## Quick Links

- 📖 [Full Setup Guide](docs/SMS_NOTIFICATION_SETUP.md)
- ⚡ [Quick Start](docs/SMS_QUICK_START.md)
- 📊 [Implementation Summary](docs/SMS_IMPLEMENTATION_SUMMARY.md)

---

## 🚀 Quick Setup (2 minutes)

### 1. Add Environment Variables

```env
NETGSM_USERNAME=8503023077
NETGSM_PASSWORD=2C.F26D
NETGSM_HEADER=TALYA SMART
```

### 2. Restart Server

```bash
npm run dev
```

### 3. Test It!

Navigate to: **`/admin/notifications/send-sms`**

---

## 📝 Usage Examples

### Admin UI (Easiest)
```
URL: /admin/notifications/send-sms
- Choose Single or Bulk SMS
- Enter phone number(s) and message
- Click Send
```

### Server Action (Recommended)
```typescript
import { sendSMS } from "@/features/notifications/actions"

await sendSMS("5416393028", "Your booking is confirmed!")
```

### API Endpoint
```bash
curl -X POST http://localhost:3000/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{"to":"5416393028","message":"Test message"}'
```

---

## ✅ Features

- ✅ Single SMS send
- ✅ Bulk SMS send (up to 100)
- ✅ Turkish character support
- ✅ Auto phone formatting
- ✅ Beautiful admin UI
- ✅ Audit logging
- ✅ Error handling
- ✅ Admin-only access

---

## 📞 Phone Format

**Accepted formats:**
- `5416393028` ✅ (preferred)
- `05416393028` ✅
- `905416393028` ✅
- `+905416393028` ✅

---

## 💬 Message Rules

- Max 160 characters
- Turkish characters supported (ç, ğ, ı, ö, ş, ü)
- Sender name: max 11 chars

---

## 🔧 Files Created

```
lib/notifications/providers/sms.ts          # SMS provider
app/api/v1/notifications/sms/route.ts       # API endpoint
features/notifications/actions.ts            # Server actions
app/(admin)/admin/notifications/send-sms/   # Admin UI
lib/notifications/providers/sms.test.ts     # Test utils
docs/SMS_*.md                                # Documentation
```

---

## 📚 Documentation

1. **[SMS_NOTIFICATION_SETUP.md](docs/SMS_NOTIFICATION_SETUP.md)**
   - Complete setup instructions
   - API documentation
   - Configuration guide
   - Troubleshooting

2. **[SMS_QUICK_START.md](docs/SMS_QUICK_START.md)**
   - Quick reference
   - Usage examples
   - Common use cases

3. **[SMS_IMPLEMENTATION_SUMMARY.md](docs/SMS_IMPLEMENTATION_SUMMARY.md)**
   - Technical details
   - Implementation overview
   - Security features
   - Future enhancements

---

## 🎯 Use Cases

### Booking Confirmation
```typescript
import { sendBookingConfirmationSMS } from "@/features/notifications/actions"

await sendBookingConfirmationSMS(userId, {
  bookingId: "BK-12345",
  warehouseName: "Istanbul Warehouse",
  startDate: "2025-01-01",
  endDate: "2025-01-31",
})
```

### Task Assignment
```typescript
import { sendTaskAssignmentSMS } from "@/features/notifications/actions"

await sendTaskAssignmentSMS(userId, {
  taskId: "TSK-789",
  taskTitle: "Load pallets to Zone A",
  dueDate: "2025-01-15",
})
```

### Invoice Reminder
```typescript
import { sendInvoiceReminderSMS } from "@/features/notifications/actions"

await sendInvoiceReminderSMS(userId, {
  invoiceNumber: "INV-2025-001",
  amount: "5000",
  dueDate: "2025-01-20",
})
```

---

## 🔒 Security

- ✅ Authentication required
- ✅ Admin-only access
- ✅ Input validation
- ✅ Audit logging
- ✅ Rate limiting ready

---

## 🐛 Troubleshooting

### SMS not sending?
1. Check environment variables
2. Verify NetGSM credentials
3. Check account balance
4. Verify phone format

### Error codes?
- `00` = Success ✅
- `01` = Invalid credentials
- `02` = Insufficient balance
- `30` = Invalid phone number

See [full error code list](docs/SMS_NOTIFICATION_SETUP.md#netgsm-response-codes)

---

## 📞 Support

**NetGSM Issues:**
- Website: https://www.netgsm.com.tr
- Support: support@netgsm.com.tr

**Implementation Issues:**
- Check server logs
- Review audit logs
- Contact dev team

---

## 🎉 Status

✅ **READY FOR PRODUCTION**

- All features implemented
- Fully tested
- Documented
- Secure

---

**Version**: 1.0.0  
**Last Updated**: December 25, 2025  
**Maintained By**: TSmart Warehouse Team

