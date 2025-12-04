// Polyfill for Web APIs required by Next.js in Jest environment
// Must be loaded before any Next.js imports

// Polyfill for TextEncoder/TextDecoder
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}

// Polyfill for ReadableStream (required by undici)
if (typeof globalThis.ReadableStream === 'undefined') {
  try {
    const { ReadableStream } = require('stream/web')
    globalThis.ReadableStream = ReadableStream
  } catch (e) {
    // Fallback if stream/web is not available
    globalThis.ReadableStream = class ReadableStream {
      constructor() {}
    }
  }
}

// Polyfill for Next.js Request/Response APIs in Jest environment
if (typeof globalThis.Request === 'undefined') {
  try {
    const { Request, Response, Headers } = require('undici')
    globalThis.Request = Request
    globalThis.Response = Response
    globalThis.Headers = Headers
  } catch (e) {
    // If undici fails, create minimal mocks
    // This is expected in some environments
  }
}

