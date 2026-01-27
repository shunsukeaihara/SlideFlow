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
  basePrompt?: string,
  referenceImageDataUrls?: string[]
): Promise<string> {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized. Please set your API key.')
  }

  const { base64, mimeType } = dataUrlToBase64(sourceImageDataUrl)

  // Build prompt with explicit image role descriptions
  let imageRoleDescription = ''
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    imageRoleDescription = `\n\n【画像の説明】\n1枚目の画像: 編集対象の画像です。この画像を編集してください。\n`
    for (let i = 0; i < referenceImageDataUrls.length; i++) {
      imageRoleDescription += `${i + 2}枚目の画像: 参照画像です。スタイルや内容を参考にしてください。\n`
    }
  }

  const fullPrompt = basePrompt
    ? `${basePrompt}\n\n${prompt}${imageRoleDescription}`
    : `${prompt}${imageRoleDescription}`

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
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

  // Add reference images to contents
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    for (const refDataUrl of referenceImageDataUrls) {
      const refData = dataUrlToBase64(refDataUrl)
      contents.push({
        inlineData: {
          mimeType: refData.mimeType,
          data: refData.base64
        }
      })
    }
  }

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
  prompt: string,
  basePrompt?: string,
  referenceImageDataUrls?: string[]
): Promise<string> {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized. Please set your API key.')
  }

  // Build prompt with explicit image role descriptions for generation
  let imageRoleDescription = ''
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    imageRoleDescription = `\n\n【画像の説明】\n`
    for (let i = 0; i < referenceImageDataUrls.length; i++) {
      imageRoleDescription += `${i + 1}枚目の画像: 参照画像です。スタイルや内容を参考にして新しい画像を生成してください。\n`
    }
  }

  const fullPrompt = basePrompt
    ? `${basePrompt}\n\n${prompt}${imageRoleDescription}`
    : `${prompt}${imageRoleDescription}`

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: fullPrompt
    }
  ]

  // Add reference images to contents
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    for (const refDataUrl of referenceImageDataUrls) {
      const refData = dataUrlToBase64(refDataUrl)
      contents.push({
        inlineData: {
          mimeType: refData.mimeType,
          data: refData.base64
        }
      })
    }
  }

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
