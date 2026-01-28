'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { OcrTextBlock } from '@/types/project'
import type { ImageEditRequest, ImageGenerateRequest, OcrRefinementRequest } from '@/lib/gemini'

// ============================================================================
// Gemini API Interface
// ============================================================================

export type GeminiMode = 'client' | 'server'

export interface GeminiAPI {
  editImage: (request: ImageEditRequest) => Promise<string>
  generateImageFromReference: (request: ImageGenerateRequest) => Promise<string>
  refineTesseractResults: (request: OcrRefinementRequest) => Promise<OcrTextBlock[]>
  isInitialized: () => boolean
  mode: GeminiMode
}

// ============================================================================
// Context
// ============================================================================

const GeminiContext = createContext<GeminiAPI | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useGemini(): GeminiAPI {
  const ctx = useContext(GeminiContext)
  if (!ctx) {
    throw new Error('useGemini must be used within GeminiProvider')
  }
  return ctx
}

// ============================================================================
// Provider
// ============================================================================

interface GeminiProviderProps {
  children: ReactNode
  api: GeminiAPI
}

export function GeminiProvider({ children, api }: GeminiProviderProps) {
  return <GeminiContext.Provider value={api}>{children}</GeminiContext.Provider>
}
