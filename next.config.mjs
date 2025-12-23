/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  typescript: {
    ignoreBuildErrors: false, // Enable type checking in production
  },
  
  // Server external packages (moved from experimental in Next.js 16)
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    // Enable Next.js Image Optimization
    unoptimized: false,
    // Configure remote image domains if using external CDN
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Add your CDN domain here when configured
      // {
      //   protocol: 'https',
      //   hostname: 'cdn.example.com',
      // },
    ],
    // Image optimization settings
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // CORS headers are handled in middleware/api-wrapper
  async headers() {
    return [
      {
        // Apply CORS to API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, X-User-ID, X-CSRF-Token',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
        ],
      },
    ]
  },
}

export default nextConfig