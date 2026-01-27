'use client'

import dynamic from 'next/dynamic'

// Dynamic import with SSR disabled for EditorPage
// This is necessary because it uses PDF.js which requires browser APIs
const EditorPage = dynamic(
  () => import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })),
  { ssr: false }
)

export default function Page() {
  return <EditorPage />
}
