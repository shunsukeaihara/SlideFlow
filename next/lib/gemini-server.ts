import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import type { OcrTextBlock } from '@/types/project'
import {
  type ImageEditRequest,
  type ImageGenerateRequest,
  type OcrRefinementRequest,
  buildEditImagePrompt,
  buildGenerateImagePrompt,
  buildImageContents,
  buildOcrRefinementPrompt,
  buildOcrContents,
  processOcrResponse
} from '@/lib/gemini'

// ============================================================================
// Server-Side Client Management
// ============================================================================

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
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
// Server-Side API Functions
// ============================================================================

export async function editImage(request: ImageEditRequest): Promise<string> {
  const client = getClient()

  const fullPrompt = buildEditImagePrompt(request)
  const contents = buildImageContents(
    fullPrompt,
    request.referenceImageDataUrls,
    request.sourceImageDataUrl
  )

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['Text', 'Image']
    }
  })

  return extractImageFromResponse(response)
}

export async function generateImageFromReference(request: ImageGenerateRequest): Promise<string> {
  const client = getClient()

  const fullPrompt = buildGenerateImagePrompt(request)
  const contents = buildImageContents(fullPrompt, request.referenceImageDataUrls)

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['Text', 'Image']
    }
  })

  return extractImageFromResponse(response)
}

export async function refineTesseractResults(
  request: OcrRefinementRequest
): Promise<OcrTextBlock[]> {
  const client = getClient()

  const prompt = buildOcrRefinementPrompt(request.tesseractBlocks)
  const contents = buildOcrContents(prompt, request.imageDataUrl)

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

    return processOcrResponse(text, request.tesseractBlocks.length)
  } catch (error) {
    console.error('Gemini refinement error:', error)
    throw new Error(
      `Gemini refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
