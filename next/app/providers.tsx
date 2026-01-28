'use client'

import { type ReactNode, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GeminiProvider, type GeminiAPI } from '@/context/GeminiContext'
import { RouterProvider, type AppRouter } from '@/context/RouterContext'
import type { ImageEditRequest, ImageGenerateRequest, OcrRefinementRequest } from '@/lib/gemini'
import { editImageAction } from '../actions/editImage'
import { generateImageAction } from '../actions/generateImage'
import { refineOcrAction } from '../actions/refineOcr'

interface ProvidersProps {
  children: ReactNode
}

/**
 * Combined providers for Next.js mode.
 * Provides both Gemini API (via Server Actions) and Router (via Next.js navigation).
 */
export function Providers({ children }: ProvidersProps) {
  const nextRouter = useRouter()

  // Server-side Gemini API using Server Actions
  const serverGeminiAPI: GeminiAPI = useMemo(
    () => ({
      editImage: async (request: ImageEditRequest) => {
        return editImageAction(request)
      },
      generateImageFromReference: async (request: ImageGenerateRequest) => {
        return generateImageAction(request)
      },
      refineTesseractResults: async (request: OcrRefinementRequest) => {
        return refineOcrAction(request)
      },
      isInitialized: () => true, // Always initialized in server mode
      mode: 'server'
    }),
    []
  )

  // Next.js router adapter
  const router: AppRouter = useMemo(
    () => ({
      push: nextRouter.push,
      replace: nextRouter.replace,
      back: nextRouter.back
    }),
    [nextRouter]
  )

  return (
    <GeminiProvider api={serverGeminiAPI}>
      <RouterProvider router={router}>{children}</RouterProvider>
    </GeminiProvider>
  )
}

// Keep for backward compatibility
export { Providers as ServerGeminiProvider }
