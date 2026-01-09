import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getMessaging, Messaging, isSupported } from 'firebase/messaging'
import { getAnalytics, Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
}

let app: FirebaseApp
let messaging: Messaging | null = null
let analytics: Analytics | null = null

// Initialize Firebase
export function getFirebaseApp() {
  if (!app) {
    // Check if Firebase app is already initialized
    const apps = getApps()
    if (apps.length > 0) {
      app = apps[0]
    } else {
      app = initializeApp(firebaseConfig)
    }
  }
  return app
}

// Get Firebase Messaging instance (client-side only)
export async function getFirebaseMessaging() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!messaging) {
    try {
      const supported = await isSupported()
      if (supported) {
        const app = getFirebaseApp()
        messaging = getMessaging(app)
      }
    } catch (error) {
      console.error('Firebase Messaging not supported:', error)
      return null
    }
  }
  return messaging
}

// Get Firebase Analytics instance (client-side only)
export function getFirebaseAnalytics() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!analytics) {
    try {
      const app = getFirebaseApp()
      analytics = getAnalytics(app)
    } catch (error) {
      console.error('Firebase Analytics not supported:', error)
      return null
    }
  }
  return analytics
}

export { firebaseConfig }

