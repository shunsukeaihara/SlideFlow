import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import type { OcrTextBlock } from '@/types/project'
import type { ImageEditRequest, ImageGenerateRequest } from './types'
import {
  buildEditImagePrompt,
  buildGenerateImagePrompt,
  buildImageContents,
  buildOcrRefinementPrompt,
  buildOcrContents,
  processOcrResponse
} from './prompts'

// ============================================================================
// Client Management
// ============================================================================

let geminiClient: GoogleGenAI | null = null

export function initializeGemini(apiKey: string): void {
  if (apiKey) {
    geminiClient = new GoogleGenAI({ apiKey })
  }
}

export function isGeminiInitialized(): boolean {
  return geminiClient !== null
}

function ensureClient(): GoogleGenAI {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized. Please set your API key.')
  }
  return geminiClient
}

function createClientWithApiKey(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error('API key is required')
  }
  return new GoogleGenAI({ apiKey })
}

// ============================================================================
// Response Processing
// ============================================================================

function extractImageFromResponse(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts) {
    throw new Error('No response from Gemini')
  }

  for (const part of parts) {
    if (part.inlineData) {
      const resultMimeType = part.inlineData.mimeType || 'image/png'
      const resultBase64 = part.inlineData.data
      return `data:${resultMimeType};base64,${resultBase64}`
    }
  }

  throw new Error('No image in response. The model may have returned text only.')
}

// ============================================================================
// Image Generation - Main Functions
// ============================================================================

export async function editImage(
  sourceImageDataUrl: string,
  prompt: string,
  basePrompt?: string,
  referenceImageDataUrls?: string[],
  sourceImageSize?: { width: number; height: number }
): Promise<string> {
  const client = ensureClient()

  const request: ImageEditRequest = {
    sourceImageDataUrl,
    prompt,
    basePrompt,
    referenceImageDataUrls,
    sourceImageSize
  }

  const fullPrompt = buildEditImagePrompt(request)
  const contents = buildImageContents(fullPrompt, referenceImageDataUrls, sourceImageDataUrl)

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['Text', 'Image']
    }
  })

  return extractImageFromResponse(response)
}

export async function generateImageFromReference(
  prompt: string,
  basePrompt?: string,
  referenceImageDataUrls?: string[]
): Promise<string> {
  const client = ensureClient()

  const request: ImageGenerateRequest = {
    prompt,
    basePrompt,
    referenceImageDataUrls
  }

  const fullPrompt = buildGenerateImagePrompt(request)
  const contents = buildImageContents(fullPrompt, referenceImageDataUrls)

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['Text', 'Image']
    }
  })

  return extractImageFromResponse(response)
}

// ============================================================================
// OCR Refinement - Main Function
// ============================================================================

export async function refineTesseractResults(
  tesseractBlocks: OcrTextBlock[],
  imageDataUrl: string,
  apiKey: string
): Promise<OcrTextBlock[]> {
  const client = createClientWithApiKey(apiKey)

  const prompt = buildOcrRefinementPrompt(tesseractBlocks)
  const contents = buildOcrContents(prompt, imageDataUrl)

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json'
      }
    })

    const text = response.text
    if (!text) {
      throw new Error('No response from Gemini')
    }

    return processOcrResponse(text, tesseractBlocks.length)
  } catch (error) {
    console.error('Gemini refinement error:', error)
    throw new Error(
      `Gemini refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
