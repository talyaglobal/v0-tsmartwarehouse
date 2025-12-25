import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getMessaging, Messaging, isSupported } from 'firebase/messaging'
import { getAnalytics, Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyDgo3Ze9RyS48BKiUKTbLAEOtG07RQ0mO0",
  authDomain: "kolaystartup.firebaseapp.com",
  projectId: "kolaystartup",
  storageBucket: "kolaystartup.firebasestorage.app",
  messagingSenderId: "885378959790",
  appId: "1:885378959790:web:946bdd5eb631fb0017203f",
  measurementId: "G-Y3XR7Y9XRL"
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

