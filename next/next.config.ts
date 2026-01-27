import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable Turbopack (moved from experimental.turbo)
  turbopack: {},

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Transpile shared src modules
  transpilePackages: [],

  // Exclude pdfjs-dist from server-side bundling (Turbopack equivalent)
  serverExternalPackages: ['pdfjs-dist'],

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
