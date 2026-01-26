import { GoogleGenAI } from '@google/genai'

let geminiClient: GoogleGenAI | null = null

export function initializeGemini(apiKey: string): void {
  if (apiKey) {
    geminiClient = new GoogleGenAI({ apiKey })
  }
}

export function isGeminiInitialized(): boolean {
  return geminiClient !== null
}

function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid data URL')
  }
  return {
    mimeType: matches[1],
    base64: matches[2]
  }
}

export async function editImage(
  sourceImageDataUrl: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized. Please set your API key.')
  }

  const { base64, mimeType } = dataUrlToBase64(sourceImageDataUrl)
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt

  const contents = [
    {
      text: fullPrompt
    },
    {
      inlineData: {
        mimeType,
        data: base64
      }
    }
  ]

  const response = await geminiClient.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents,
    config: {
      responseModalities: ['Text', 'Image']
    }
  })

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

export async function generateImageFromReference(
  referenceImageDataUrl: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  return editImage(referenceImageDataUrl, prompt, systemPrompt)
}
