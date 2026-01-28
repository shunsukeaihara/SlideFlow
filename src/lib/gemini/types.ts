import type { OcrTextBlock } from '@/types/project'

// ============================================================================
// Request/Response Types for Gemini API
// ============================================================================

export interface ImageEditRequest {
  sourceImageDataUrl: string
  prompt: string
  basePrompt?: string
  referenceImageDataUrls?: string[]
  sourceImageSize?: { width: number; height: number }
}

export interface ImageGenerateRequest {
  prompt: string
  basePrompt?: string
  referenceImageDataUrls?: string[]
}

export interface OcrRefinementRequest {
  tesseractBlocks: OcrTextBlock[]
  imageDataUrl: string
}

// ============================================================================
// Internal Types
// ============================================================================

export type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } }

export interface OcrContentMessage {
  role: string
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
}
