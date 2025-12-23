/**
 * Server Actions Wrapper
 * Provides consistent error handling and validation for Server Actions
 */

import { z } from 'zod'
import { success, failure, type Result } from '@/lib/shared/result'

/**
 * Wrap a Server Action with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  action: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await action(...args)
    } catch (error) {
      console.error('Server Action error:', error)
      if (error instanceof z.ZodError) {
        return failure(error.errors[0].message)
      }
      if (error instanceof Error) {
        return failure(error.message)
      }
      return failure('An unexpected error occurred')
    }
  }) as T
}

/**
 * Validate input with Zod schema
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): Result<T, string> {
  try {
    const validated = schema.parse(input)
    return success(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return failure(`${firstError.path.join('.')}: ${firstError.message}`)
    }
    return failure('Validation failed')
  }
}

