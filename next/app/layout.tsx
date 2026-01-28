import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  title: 'SlideFlow',
  description: 'Edit NotebookLM-generated slide PDFs using Google Gemini AI'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className="h-screen w-screen overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
