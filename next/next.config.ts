import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable Turbopack (moved from experimental.turbo)
  turbopack: {},

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Allow cross-origin requests from localhost/127.0.0.1 in development
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'],

  // Transpile shared src modules
  transpilePackages: [],

  // Exclude packages from server-side bundling
  // - pdfjs-dist: PDF rendering (client-side only)
  // - sharp: Native image processing library
  serverExternalPackages: ['pdfjs-dist', 'sharp'],

  // Remove console.log/warn in production builds
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error'] // Keep console.error for critical errors
          }
        : false
  }
}

export default nextConfig
