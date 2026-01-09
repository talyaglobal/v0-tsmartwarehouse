#!/usr/bin/env node

/**
 * Environment Variable Checker
 * Verifies that all required Supabase environment variables are set
 */

const fs = require('fs')
const path = require('path')

// Try to load .env.local file
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value
        }
      }
    }
  })
}

const requiredEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    description: 'Supabase project URL',
    example: 'https://your-project.supabase.co',
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: true,
    description: 'Supabase anonymous/public key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: false,
    description: 'Supabase service role key (for admin operations)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    note: 'Optional but recommended for server-side admin operations',
  },
  NEXT_PUBLIC_SITE_URL: {
    required: false,
    description: 'Your site URL (for email redirects)',
    example: 'http://localhost:3000',
    note: 'Optional, defaults to http://localhost:3000',
  },
  STRIPE_SECRET_KEY: {
    required: false,
    description: 'Stripe secret API key (for payment processing)',
    example: 'sk_test_...',
    note: 'Required for payment features. Get from: https://dashboard.stripe.com/apikeys',
  },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
    required: false,
    description: 'Stripe publishable API key (for frontend)',
    example: 'pk_test_...',
    note: 'Required for payment UI. Get from: https://dashboard.stripe.com/apikeys',
  },
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: {
    required: false,
    description: 'Google Maps API key (for Maps, Places, Geocoding)',
    example: 'AIzaSy...',
    note: 'Required for map features. Get from: https://console.cloud.google.com/apis/credentials',
  },
  GOOGLE_API_SECRET: {
    required: false,
    description: 'Google API Secret (for server-side operations)',
    example: '...',
    note: 'Optional, for server-side Google API operations',
  },
}

function checkEnvVars() {
  console.log('🔍 Checking environment variables...\n')
  
  const missing = []
  const optional = []
  const present = []

  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[key]
    
    if (!value) {
      if (config.required) {
        missing.push({ key, ...config })
      } else {
        optional.push({ key, ...config })
      }
    } else {
      // Mask sensitive values
      const maskedValue = key.includes('KEY') 
        ? `${value.substring(0, 20)}...` 
        : value
      present.push({ key, value: maskedValue, ...config })
    }
  }

  // Display results
  if (present.length > 0) {
    console.log('✅ Present environment variables:')
    present.forEach(({ key, value, description }) => {
      console.log(`   ${key}: ${value}`)
      console.log(`   └─ ${description}\n`)
    })
  }

  if (optional.length > 0) {
    console.log('⚠️  Optional environment variables (not set):')
    optional.forEach(({ key, description, note }) => {
      console.log(`   ${key}`)
      console.log(`   └─ ${description}`)
      if (note) console.log(`   └─ Note: ${note}\n`)
    })
  }

  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:')
    missing.forEach(({ key, description, example }) => {
      console.log(`   ${key}`)
      console.log(`   └─ ${description}`)
      console.log(`   └─ Example: ${example}\n`)
    })
    console.log('\n💡 To fix:')
    console.log('   1. Copy .env.example to .env.local')
    console.log('   2. Add your Supabase credentials from your Supabase project dashboard')
    console.log('   3. Get your credentials from: Settings → API\n')
    process.exit(1)
  }

  // Validate format
  console.log('🔎 Validating format...\n')
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url && !url.startsWith('https://') && !url.startsWith('http://localhost')) {
    console.log('⚠️  Warning: NEXT_PUBLIC_SUPABASE_URL should start with https://')
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (anonKey && !anonKey.startsWith('eyJ')) {
    console.log('⚠️  Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY should start with "eyJ" (JWT format)')
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && !serviceKey.startsWith('eyJ')) {
    console.log('⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY should start with "eyJ" (JWT format)')
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (stripeSecretKey && !stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
    console.log('⚠️  Warning: STRIPE_SECRET_KEY should start with "sk_test_" (test) or "sk_live_" (production)')
  }

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (stripePublishableKey && !stripePublishableKey.startsWith('pk_test_') && !stripePublishableKey.startsWith('pk_live_')) {
    console.log('⚠️  Warning: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with "pk_test_" (test) or "pk_live_" (production)')
  }

  // Check if Stripe keys are missing but payment features might be needed
  if (!stripeSecretKey || !stripePublishableKey) {
    console.log('\n💡 Payment Processing:')
    if (!stripeSecretKey) {
      console.log('   ⚠️  STRIPE_SECRET_KEY is not set (required for payment processing)')
    }
    if (!stripePublishableKey) {
      console.log('   ⚠️  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set (required for payment UI)')
    }
    console.log('   Get your Stripe keys from: https://dashboard.stripe.com/apikeys')
    console.log('   See PAYMENT_SETUP.md for detailed setup instructions\n')
  }

  console.log('\n✅ All required environment variables are set!')
  console.log('🚀 You can now run: npm run dev\n')
}

checkEnvVars()

