'use client'

import dynamic from 'next/dynamic'

// Dynamic import with SSR disabled
// Required because shared components use browser-only APIs
const SettingsPage = dynamic(
  () => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
  { ssr: false }
)

export default function Page() {
  return <SettingsPage />
}
