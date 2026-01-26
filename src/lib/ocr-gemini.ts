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
OCR精度が低いので、画像を見ながら正確なテキストに修正してください。

重要な制約:
- "confidence"フィールドと"lines[].bbox"フィールドは変更しないでください
- **必ず"lines"配列内の各行の"text"フィールドも修正してください**

タスク:
1. 画像を見て、各ブロックの"text"フィールドを正確に読み取って修正
2. **各ブロックの"lines"配列が存在する場合、各行の"text"フィールドも必ず修正してください**
   - "lines[0].text", "lines[1].text", ... を全て正しいテキストに更新
   - "block.text"は全行のテキストを改行で連結したもの
   - 例: block.text が "Hello\\nWorld" なら、lines[0].text は "Hello", lines[1].text は "World"
3. ゴミだと思われるブロック（意味のない記号のみ、ノイズ、明らかな誤認識）は配列から削除
4. 画像上で意味的に同じグループ（例：同じタイトル、同じ段落）に属するブロックは結合
   - 結合時は"lines"配列を統合（全ての行のbboxを保持）
   - ** 結合後の"bbox"は、全ての行を含む最小の矩形として計算 **
   - 結合後の"text"は、各行のテキストを改行で連結
5. 有効なテキストブロックのみを含むJSON配列で返す

**重要**: 返却するJSONでは、block.textとlines[].textの両方が正しく修正されている必要があります。

OCR結果:
${JSON.stringify(tesseractBlocks, null, 2)}

有効なテキストブロックのみを含むJSON配列形式で返してください。`

  try {
    const response = await geminiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp',
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

    console.log('[Gemini] Raw JSON response:', text)

    // Parse the JSON response
    const refinedBlocks = JSON.parse(text) as OcrTextBlock[]
    console.log('[Gemini] Parsed blocks:', JSON.stringify(refinedBlocks, null, 2))

    // Validate the response structure
    if (!Array.isArray(refinedBlocks)) {
      throw new Error('Gemini response is not an array')
    }

    // Filter out invalid blocks and ensure all remaining blocks have required fields
    const validBlocks = refinedBlocks.filter((block) => {
      if (!block.text || !block.bbox) {
        console.warn('[Gemini] Skipping invalid block:', block)
        return false
      }
      // Also filter out blocks with empty or whitespace-only text
      if (!block.text.trim()) {
        console.warn('[Gemini] Skipping empty text block')
        return false
      }
      return true
    })

    // Update lines[].text to match the refined block.text
    const updatedBlocks = validBlocks.map((block) => {
      if (block.lines && block.lines.length > 0) {
        // Split block.text by newlines to get refined line texts
        const refinedLineTexts = block.text.split('\n')

        // Update each line's text with the corresponding refined text
        const updatedLines = block.lines.map((line, index) => ({
          ...line,
          text: refinedLineTexts[index] || line.text
        }))

        return {
          ...block,
          lines: updatedLines
        }
      }
      return block
    })

    console.log(
      `[Gemini] Refined ${tesseractBlocks.length} blocks to ${updatedBlocks.length} valid blocks`
    )

    return updatedBlocks
  } catch (error) {
    console.error('Gemini refinement error:', error)
    throw new Error(
      `Gemini refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
