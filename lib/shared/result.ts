/**
 * Result Type Pattern
 * Provides type-safe error handling for Server Actions and async operations
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E; message?: string }

/**
 * Create a success result
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data }
}

/**
 * Create an error result
 */
export function failure<E = Error>(error: E, message?: string): Result<never, E> {
  return { success: false, error, message }
}

/**
 * Check if result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true
}

/**
 * Check if result is failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E; message?: string } {
  return result.success === false
}

/**
 * Unwrap result, throwing if failure
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.data
  }
  throw result.error
}

/**
 * Unwrap result with default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.success ? result.data : defaultValue
}

/**
 * Map over result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.success) {
    return success(fn(result.data))
  }
  return result
}

