#!/usr/bin/env node

/**
 * Create Admin User Script
 * Creates an admin user in Supabase Auth with the admin role
 * 
 * Usage: node scripts/create-admin-user.js <email> <password> [name]
 * Example: node scripts/create-admin-user.js admin@example.com password123 "Admin User"
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env.local
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

// Get command line arguments
const [, , email, password, name] = process.argv

// Validate required arguments
if (!email || !password) {
  console.error('❌ Error: Missing required arguments')
  console.log('\nUsage: node scripts/create-admin-user.js <email> <password> [name]')
  console.log('Example: node scripts/create-admin-user.js volkan@tsmart.ai 12345678 "Volkan Admin"')
  process.exit(1)
}

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL environment variable is not set')
  console.log('   Please set it in your .env.local file')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set')
  console.log('   This key is required for admin operations')
  console.log('   You can find it in your Supabase project dashboard: Settings → API')
  process.exit(1)
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...')
    console.log(`   Email: ${email}`)
    console.log(`   Name: ${name || email.split('@')[0]}`)
    console.log(`   Role: admin\n`)

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase.auth.admin.listUsers()
    
    if (checkError) {
      console.error('❌ Error checking existing users:', checkError.message)
      process.exit(1)
    }

    const userExists = existingUser.users.find(u => u.email === email)
    
    if (userExists) {
      console.log(`⚠️  User with email ${email} already exists`)
      console.log(`   User ID: ${userExists.id}`)
      console.log(`\n   Updating user to admin role...`)

      // Update user metadata and password
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        userExists.id,
        {
          password: password, // Reset password
          user_metadata: {
            role: 'admin',
            name: name || userExists.user_metadata?.name || email.split('@')[0],
          },
        }
      )

      if (updateError) {
        console.error('❌ Error updating user:', updateError.message)
        process.exit(1)
      }

      // Update profile directly
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          name: name || updatedUser.user.user_metadata?.name || email.split('@')[0],
        })
        .eq('id', userExists.id)

      if (profileError) {
        console.error('⚠️  Warning: Could not update profile:', profileError.message)
        console.log('   The user was updated in auth, but profile update failed.')
        console.log('   You may need to update the profile manually in the database.')
      } else {
        console.log('✅ Profile updated successfully')
      }

      console.log('\n✅ Admin user updated successfully!')
      console.log(`   User ID: ${updatedUser.user.id}`)
      console.log(`   Email: ${updatedUser.user.email}`)
      console.log(`   Role: ${updatedUser.user.user_metadata?.role}`)
      console.log(`   Password: Updated`)
      console.log(`\n💡 You can now log in with:`)
      console.log(`   Email: ${email}`)
      console.log(`   Password: ${password}`)
      return
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'admin',
        name: name || email.split('@')[0],
      },
    })

    if (createError) {
      console.error('❌ Error creating user:', createError.message)
      process.exit(1)
    }

    console.log('✅ User created in auth system')

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update profile to ensure role is set to admin
    // The trigger should create it, but we'll verify and update if needed
    const { data: profile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', newUser.user.id)
      .single()

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('⚠️  Warning: Error checking profile:', profileCheckError.message)
    }

    if (profile) {
      // Profile exists, update it
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          name: name || newUser.user.user_metadata?.name || email.split('@')[0],
        })
        .eq('id', newUser.user.id)

      if (profileUpdateError) {
        console.error('⚠️  Warning: Could not update profile:', profileUpdateError.message)
      } else {
        console.log('✅ Profile created/updated with admin role')
      }
    } else {
      // Profile doesn't exist yet, create it manually
      const { error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: newUser.user.email,
          name: name || newUser.user.user_metadata?.name || email.split('@')[0],
          role: 'admin',
        })

      if (profileCreateError) {
        console.error('⚠️  Warning: Could not create profile:', profileCreateError.message)
        console.log('   The user was created in auth, but profile creation failed.')
        console.log('   The trigger should create it automatically, or you can create it manually.')
      } else {
        console.log('✅ Profile created with admin role')
      }
    }

    console.log('\n✅ Admin user created successfully!')
    console.log(`   User ID: ${newUser.user.id}`)
    console.log(`   Email: ${newUser.user.email}`)
    console.log(`   Role: admin`)
    console.log(`\n💡 You can now log in with:`)
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

createAdminUser()

