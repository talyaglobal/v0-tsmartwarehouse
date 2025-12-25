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
    // Try to use Node.js built-in fetch (Node 18+)
    const { Request, Response, Headers, FormData } = require('undici')
    globalThis.Request = Request
    globalThis.Response = Response
    globalThis.Headers = Headers
    globalThis.FormData = FormData
    globalThis.fetch = require('undici').fetch
  } catch (e) {
    // If undici fails, try node-fetch as fallback
    try {
      const fetch = require('node-fetch')
      globalThis.fetch = fetch
      globalThis.Request = fetch.Request
      globalThis.Response = fetch.Response
      globalThis.Headers = fetch.Headers
    } catch (e2) {
      console.warn('Could not polyfill Request/Response APIs')
    }
  }
}

