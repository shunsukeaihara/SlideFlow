import { GoogleGenAI } from '@google/genai'
import type { OcrTextBlock } from '../types/project'

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

export async function refineTesseractResults(
  tesseractBlocks: OcrTextBlock[],
  imageDataUrl: string,
  apiKey: string
): Promise<OcrTextBlock[]> {
  if (!apiKey) {
    throw new Error('API key is required for Gemini refinement')
  }

  const geminiClient = new GoogleGenAI({ apiKey })
  const { base64, mimeType } = dataUrlToBase64(imageDataUrl)

  const prompt = `以下は画像から抽出したOCR結果（Tesseract）のJSON配列です。

タスク:
1. 画像を見て、各テキストブロックの"text"フィールドを正確に修正してください
2. "bbox"フィールドと"confidence"フィールドは絶対に変更しないでください
3. テキストブロックの追加・削除は行わないでください
4. 同じJSON配列構造で返してください

OCR結果:
${JSON.stringify(tesseractBlocks, null, 2)}

JSON配列形式で返してください。`

  try {
    const response = await geminiClient.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    })

    const text = response.text
    if (!text) {
      throw new Error('No response from Gemini')
    }

    // Parse the JSON response
    const refinedBlocks = JSON.parse(text) as OcrTextBlock[]

    // Validate the response structure
    if (!Array.isArray(refinedBlocks)) {
      throw new Error('Gemini response is not an array')
    }

    // Ensure all blocks have required fields
    for (const block of refinedBlocks) {
      if (!block.text || !block.bbox) {
        throw new Error('Invalid block structure in Gemini response')
      }
    }

    return refinedBlocks
  } catch (error) {
    console.error('Gemini refinement error:', error)
    throw new Error(
      `Gemini refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
