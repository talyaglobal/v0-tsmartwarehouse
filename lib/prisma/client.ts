/**
 * Prisma Client Singleton
 * 
 * This module provides a singleton Prisma client instance for use throughout the application.
 * It handles connection pooling and is optimized for Next.js serverless/edge environments.
 * 
 * Usage:
 *   import { prisma } from '@/lib/prisma/client'
 *   const warehouses = await prisma.warehouses.findMany()
 */

// Import will be available after running: npx prisma generate
// For now, we use a type-safe approach that works once schema is generated
// Note: Prisma is not currently in use - this file is for future migration
// @ts-ignore - Prisma types will be available after generation
import type { PrismaClient as PrismaClientType } from '@prisma/client'

// Dynamic import to handle cases where Prisma hasn't been generated yet
let PrismaClient: typeof PrismaClientType

try {
  const prismaModule = require('@/lib/generated/prisma')
  PrismaClient = prismaModule.PrismaClient
} catch (error) {
  // Prisma not generated yet - will fail at runtime with helpful error
  console.warn('[Prisma] Prisma client not generated yet. Run: npx prisma generate')
}

// Extend PrismaClient to add logging in development
const prismaClientSingleton = () => {
  if (!PrismaClient) {
    throw new Error(
      'Prisma client not initialized. Please run:\n' +
      '1. Add DATABASE_URL to .env.local\n' +
      '2. npx prisma db pull\n' +
      '3. npx prisma generate'
    )
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  })
}

// Global variable to store the Prisma client instance
// This prevents multiple instances in development (hot reload)
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// Create or reuse the Prisma client instance
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

// In development, store the instance globally to prevent multiple connections
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

// Handle graceful shutdown
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

export { prisma }

/**
 * Helper function to safely execute Prisma queries with error handling
 */
export async function withPrisma<T>(
  queryFn: (prisma: any) => Promise<T>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await queryFn(prisma)
    return { data, error: null }
  } catch (error) {
    console.error('[Prisma] Query error:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown Prisma error'),
    }
  }
}

