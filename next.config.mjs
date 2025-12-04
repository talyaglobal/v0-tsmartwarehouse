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
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
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
            value: 'Content-Type, Authorization, X-Requested-With, X-User-ID',
          },
        ],
      },
    ]
  },
}

export default nextConfig