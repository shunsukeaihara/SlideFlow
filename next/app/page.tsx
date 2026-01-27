'use client'

import dynamic from 'next/dynamic'

// Dynamic import with SSR disabled
// Required because shared components use browser-only APIs (PDF.js, etc.)
const HomePage = dynamic(
  () => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })),
  { ssr: false }
)

export default function Page() {
  return <HomePage />
}
