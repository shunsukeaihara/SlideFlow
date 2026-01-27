import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable Turbopack (moved from experimental.turbo)
  turbopack: {},

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Transpile shared src modules
  transpilePackages: [],

  // Exclude pdfjs-dist from server-side bundling (Turbopack equivalent)
  serverExternalPackages: ['pdfjs-dist']
}

export default nextConfig
