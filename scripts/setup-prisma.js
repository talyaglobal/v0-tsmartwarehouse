#!/usr/bin/env node

/**
 * Automated Prisma Setup Script
 * 
 * This script automatically:
 * 1. Pulls the database schema
 * 2. Generates the Prisma client
 * 
 * Usage: npm run prisma:setup
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🚀 Starting Prisma setup...\n')

// Check if DATABASE_URL is set
const envPath = path.join(process.cwd(), '.env.local')
let envVars = {}

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      envVars[key] = value
    }
  })
}

if (!envVars.DATABASE_URL && !process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not found!')
  console.error('\nPlease add DATABASE_URL to your .env.local file:')
  console.error('\n  DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"')
  console.error('\nYou can find your connection string in Supabase Dashboard:')
  console.error('  Settings → Database → Connection string → URI')
  process.exit(1)
}

const databaseUrl = envVars.DATABASE_URL || process.env.DATABASE_URL
console.log('✅ DATABASE_URL found\n')

try {
  // Step 1: Pull database schema
  console.log('📥 Pulling database schema...')
  execSync('npx prisma db pull', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })
  console.log('✅ Schema pulled successfully!\n')

  // Step 2: Generate Prisma client
  console.log('🔧 Generating Prisma client...')
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })
  console.log('✅ Prisma client generated successfully!\n')

  console.log('🎉 Prisma setup completed!')
  console.log('\nYou can now use Prisma in your code:')
  console.log('  import { prisma } from "@/lib/prisma/client"')
} catch (error) {
  console.error('\n❌ Prisma setup failed:', error.message)
  process.exit(1)
}

