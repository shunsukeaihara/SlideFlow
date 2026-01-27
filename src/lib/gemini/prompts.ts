import type { OcrTextBlock } from '@/types/project'
import type {
  ImageEditRequest,
  ImageGenerateRequest,
  ContentPart,
  OcrContentMessage
} from './types'

// ============================================================================
// Common Utilities
// ============================================================================

export function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid data URL')
  }
  return {
    mimeType: matches[1],
    base64: matches[2]
  }
}

// ============================================================================
// Image Generation - Prompt Builders
// ============================================================================

export function buildEditImagePrompt(request: ImageEditRequest): string {
  const { prompt, basePrompt, referenceImageDataUrls, sourceImageSize } = request

  // Add size constraint for the output image
  const sizeConstraint = sourceImageSize
    ? `\n\n【重要】出力画像は編集対象画像と同じサイズ（${sourceImageSize.width}x${sourceImageSize.height}ピクセル）およびアスペクト比を維持してください。参照画像のサイズやアスペクト比に影響されないでください。`
    : '\n\n【重要】出力画像は編集対象画像と同じサイズおよびアスペクト比を維持してください。参照画像のサイズやアスペクト比に影響されないでください。'

  let imageRoleDescription = ''
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    imageRoleDescription = `\n\n【画像の説明】\n`
    for (let i = 0; i < referenceImageDataUrls.length; i++) {
      imageRoleDescription += `${i + 1}枚目の画像: 参照画像です。スタイルや内容を参考にしてください。\n`
    }
    imageRoleDescription += `${referenceImageDataUrls.length + 1}枚目の画像: 編集対象の画像です。指定された内容に従ってこの画像を編集してください。指定されていない部分は絶対に変更しないでください。\n`
  } else {
    imageRoleDescription = `\n\n【画像の説明】\n1枚目の画像: 編集対象の画像です。指定された内容に従ってこの画像を編集してください。指定されていない部分は絶対に変更しないでください。\n`
  }

  return basePrompt
    ? `${basePrompt}\n\n${prompt}${imageRoleDescription}${sizeConstraint}`
    : `${prompt}${imageRoleDescription}${sizeConstraint}`
}

export function buildGenerateImagePrompt(request: ImageGenerateRequest): string {
  const { prompt, basePrompt, referenceImageDataUrls } = request

  let imageRoleDescription = ''
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    imageRoleDescription = `\n\n【画像の説明】\n`
    for (let i = 0; i < referenceImageDataUrls.length; i++) {
      imageRoleDescription += `${i + 1}枚目の画像: 参照画像です。スタイルや内容を参考にして新しい画像を生成してください。\n`
    }
  }

  return basePrompt
    ? `${basePrompt}\n\n${prompt}${imageRoleDescription}`
    : `${prompt}${imageRoleDescription}`
}

export function buildImageContents(
  fullPrompt: string,
  referenceImageDataUrls?: string[],
  sourceImageDataUrl?: string
): ContentPart[] {
  const contents: ContentPart[] = [{ text: fullPrompt }]

  // Add reference images first (in order: 1枚目, 2枚目, ...)
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

  // Add source/target image last (if provided)
  if (sourceImageDataUrl) {
    const { base64, mimeType } = dataUrlToBase64(sourceImageDataUrl)
    contents.push({
      inlineData: {
        mimeType,
        data: base64
      }
    })
  }

  return contents
}

// ============================================================================
// OCR Refinement - Prompt Builders
// ============================================================================

export function buildOcrRefinementPrompt(tesseractBlocks: OcrTextBlock[]): string {
  return `以下は画像から抽出したOCR結果（Tesseract）のJSON配列です。
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
4. 画像上で意味的に同じグループに属するブロックは結合
   - 結合時は"lines"配列を統合（全ての行のbboxを保持）
   - ** 結合後の"bbox"は、全ての行を含む最小の矩形として計算 **
   - 結合後の"text"は、各行のテキストを改行で連結
   - 意味的なつながりだけでなく、*文字サイズの違い**も鑑みて、結合すべきか否かも判定してください。
5. 有効なテキストブロックのみを含むJSON配列で返す
6. textが、'NotebookLM' というだけの画面右下のブロックは無視してください。

**重要**: 返却するJSONでは、block.textとlines[].textの両方が正しく修正されている必要があります。

OCR結果:
${JSON.stringify(tesseractBlocks, null, 2)}

有効なテキストブロックのみを含むJSON配列形式で返してください。`
}

export function buildOcrContents(prompt: string, imageDataUrl: string): OcrContentMessage[] {
  const { base64, mimeType } = dataUrlToBase64(imageDataUrl)

  return [
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
  ]
}

// ============================================================================
// OCR Response Processing
// ============================================================================

export function parseOcrResponse(text: string): OcrTextBlock[] {
  console.debug('[Gemini] Raw JSON response:', text)

  const refinedBlocks = JSON.parse(text) as OcrTextBlock[]
  console.debug('[Gemini] Parsed blocks:', JSON.stringify(refinedBlocks, null, 2))

  if (!Array.isArray(refinedBlocks)) {
    throw new Error('Gemini response is not an array')
  }

  return refinedBlocks
}

export function validateOcrBlocks(blocks: OcrTextBlock[]): OcrTextBlock[] {
  return blocks.filter((block) => {
    if (!block.text || !block.bbox) {
      console.warn('[Gemini] Skipping invalid block:', block)
      return false
    }
    if (!block.text.trim()) {
      console.warn('[Gemini] Skipping empty text block')
      return false
    }
    return true
  })
}

export function synchronizeLineTexts(blocks: OcrTextBlock[]): OcrTextBlock[] {
  return blocks.map((block) => {
    if (block.lines && block.lines.length > 0) {
      const refinedLineTexts = block.text.split('\n')
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
}

export function processOcrResponse(text: string, originalBlockCount: number): OcrTextBlock[] {
  const refinedBlocks = parseOcrResponse(text)
  const validBlocks = validateOcrBlocks(refinedBlocks)
  const updatedBlocks = synchronizeLineTexts(validBlocks)

  console.log(`[Gemini] Refined ${originalBlockCount} blocks to ${updatedBlocks.length} valid blocks`)

  return updatedBlocks
}
