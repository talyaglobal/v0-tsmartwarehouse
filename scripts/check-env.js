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

  console.log('\n✅ All required environment variables are set!')
  console.log('🚀 You can now run: npm run dev\n')
}

checkEnvVars()

