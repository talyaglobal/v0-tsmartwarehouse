# Firebase Push Notifications Setup Guide

**Last Updated**: December 25, 2025

---

## Overview

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the TSmart Warehouse application.

---

## Prerequisites

- Firebase project created (kolaystartup)
- Firebase app registered (1:885378959790:web:946bdd5eb631fb0017203f)
- Admin access to Firebase Console

---

## Configuration Steps

### 1. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **kolaystartup**
3. Navigate to **Project Settings** > **Cloud Messaging**
4. Generate VAPID key if not already generated
5. Copy the Server Key (Legacy)

### 2. Environment Variables

Add the following to your `.env.local` file:

```env
# Firebase Configuration (Already configured)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDgo3Ze9RyS48BKiUKTbLAEOtG07RQ0mO0
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kolaystartup.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kolaystartup
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kolaystartup.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=885378959790
NEXT_PUBLIC_FIREBASE_APP_ID=1:885378959790:web:946bdd5eb631fb0017203f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-Y3XR7Y9XRL

# Required: Get these from Firebase Console
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here
FIREBASE_SERVER_KEY=your_server_key_here
```

### 3. Database Migration

Run the migration to add FCM token column:

```bash
# Apply migration
npm run db:migrate
```

Or manually run:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON profiles(fcm_token) WHERE fcm_token IS NOT NULL;
```

### 4. Install Dependencies

Firebase package should already be installed. If not:

```bash
npm install firebase
```

---

## Files Created

### 1. Firebase Configuration
**File**: `lib/firebase/config.ts`
- Firebase app initialization
- Messaging instance
- Analytics instance
- Browser compatibility checks

### 2. Client-Side Messaging
**File**: `lib/firebase/messaging.ts`
- Request notification permission
- Get FCM token
- Listen for foreground messages
- Save token to profile

### 3. Service Worker
**File**: `public/firebase-messaging-sw.js`
- Handle background messages
- Display notifications
- Handle notification clicks

### 4. React Component
**File**: `components/notifications/push-notification-setup.tsx`
- User-friendly permission request UI
- Status indicators
- Toast notifications

### 5. Server-Side Sender
**File**: `lib/notifications/push-sender.ts`
- Send to specific user
- Send to all admins
- Send to multiple users
- FCM REST API integration

### 6. API Endpoint
**File**: `app/api/v1/notifications/fcm-token/route.ts`
- Save FCM token to profile
- Token validation

---

## Usage

### Enable Notifications (Client-Side)

```tsx
import { PushNotificationSetup } from '@/components/notifications/push-notification-setup'

export default function SettingsPage() {
  return (
    <div>
      <h1>Notification Settings</h1>
      <PushNotificationSetup />
    </div>
  )
}
```

### Send Notification (Server-Side)

```typescript
import { sendPushNotificationToUser } from '@/lib/notifications/push-sender'

// Send to specific user
await sendPushNotificationToUser('user-id', {
  title: 'New Task Assigned',
  body: 'You have been assigned a new task',
  data: {
    taskId: 'task-123',
    type: 'task',
  },
})
```

### Send to All Admins

```typescript
import { sendPushNotificationToAdmins } from '@/lib/notifications/push-sender'

await sendPushNotificationToAdmins({
  title: 'New Booking Request',
  body: 'A customer has requested a new booking',
  data: {
    bookingId: 'booking-123',
  },
})
```

---

## Testing

### 1. Test Permission Request

1. Open the app in a browser
2. Navigate to notification settings
3. Click "Enable Notifications"
4. Grant permission when prompted
5. Verify FCM token is saved to profile

### 2. Test Foreground Notifications

1. Keep the app open
2. Send a test notification from Firebase Console
3. Verify toast notification appears

### 3. Test Background Notifications

1. Minimize or close the app
2. Send a test notification from Firebase Console
3. Verify system notification appears
4. Click notification and verify app opens

### 4. Send Test from Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Click "Send your first message"
3. Enter title and body
4. Select target: User segment or specific token
5. Send and verify receipt

---

## Integration with Existing Notification System

### Update Notification Service

```typescript
// lib/notifications/service.ts
import { sendPushNotificationToUser } from './push-sender'

export async function sendNotification(userId: string, notification: Notification) {
  // Send in-app notification
  await createInAppNotification(userId, notification)
  
  // Send email
  await sendEmailNotification(userId, notification)
  
  // Send push notification
  await sendPushNotificationToUser(userId, {
    title: notification.title,
    body: notification.message,
    data: {
      notificationId: notification.id,
      type: notification.type,
    },
  })
}
```

---

## Security Considerations

### 1. VAPID Key
- Keep VAPID key secure
- Use environment variables
- Never commit to repository

### 2. Server Key
- Keep server key secret
- Only use on server-side
- Rotate regularly

### 3. Token Storage
- Store FCM tokens securely in database
- Implement token refresh mechanism
- Clean up invalid tokens

### 4. Permission
- Always request permission explicitly
- Respect user's choice
- Provide opt-out mechanism

---

## Troubleshooting

### Permission Denied
**Issue**: User denied notification permission

**Solution**:
1. Instruct user to enable in browser settings
2. Provide clear instructions
3. Show status indicator

### Token Not Generated
**Issue**: FCM token not generated

**Solution**:
1. Check VAPID key is correct
2. Verify service worker is registered
3. Check browser compatibility
4. Check Firebase project configuration

### Notifications Not Received
**Issue**: Notifications not appearing

**Solution**:
1. Verify FCM token is saved to profile
2. Check Firebase server key
3. Verify service worker is active
4. Check browser notification settings
5. Test with Firebase Console

### Service Worker Not Registered
**Issue**: Service worker fails to register

**Solution**:
1. Ensure file is in `/public` directory
2. Check file name: `firebase-messaging-sw.js`
3. Verify Firebase configuration
4. Check browser console for errors

---

## Browser Support

### Supported Browsers
- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Edge 17+
- ✅ Opera 37+
- ✅ Safari 16+ (macOS 13+, iOS 16.4+)

### Not Supported
- ❌ Internet Explorer
- ❌ Older Safari versions
- ❌ Private/Incognito mode (some browsers)

---

## Best Practices

### 1. Request Permission at Right Time
- Don't request on page load
- Request in context (e.g., settings page)
- Explain benefits before requesting

### 2. Handle Errors Gracefully
- Show clear error messages
- Provide fallback options
- Don't break user experience

### 3. Respect User Preferences
- Allow opt-out
- Provide granular controls
- Honor notification preferences

### 4. Optimize Notification Content
- Keep titles short and clear
- Provide actionable information
- Include relevant data

### 5. Monitor and Maintain
- Track delivery rates
- Clean up invalid tokens
- Monitor error logs
- Update Firebase SDK regularly

---

## Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications](https://web.dev/push-notifications-overview/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

---

## Next Steps

1. ✅ Get VAPID key from Firebase Console
2. ✅ Get Server Key from Firebase Console
3. ✅ Add keys to environment variables
4. ✅ Run database migration
5. ✅ Test notification flow
6. ✅ Integrate with existing notification system
7. ✅ Deploy to production

---

**Maintained By**: TSmart Development Team  
**Last Updated**: December 25, 2025

