import type { OcrTextBlock, OcrResult } from '@/types/project'
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

export const systemInstruction =
  'あなたはプレゼンテーションスライドを画像として生成する優秀なAIアシスタントです。参考画像とユーザーの指示を基に、高品質なスライド画像を生成してください。'

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Template for image editing prompts.
 * Placeholders:
 * - {{basePrompt}}: User-defined base prompt (system instruction)
 * - {{prompt}}: User's edit instruction for this specific edit
 * - {{imageRoleDescription}}: Description of each image's role
 * - {{ocrText}}: OCR text extracted from the source image (optional)
 */
export const EDIT_IMAGE_TEMPLATE = `# 画像編集に関する指示

{{basePrompt}}
{{prompt}}

# 画像の役割についての説明

{{imageRoleDescription}}

{{ocrText}}
`

/**
 * Template for OCR text section.
 * Placeholders:
 * - {{ocrContent}}: The actual OCR text content
 */
export const OCR_TEXT_TEMPLATE = `
[現在のスライドのテキスト内容]
以下はOCRで読み取ったテキストです。不完全な場合があるため、画像からもテキスト内容を認識してください。

{{ocrContent}}
`

/**
 * Template for image generation prompts.
 * Placeholders:
 * - {{basePrompt}}: User-defined base prompt (system instruction)
 * - {{prompt}}: User's generation instruction
 * - {{imageRoleDescription}}: Description of reference images' roles
 */
export const GENERATE_IMAGE_TEMPLATE = `# 画像生成に関する指示

{{basePrompt}}
{{prompt}}

# 画像の役割についての説明

{{imageRoleDescription}}

`

/**
 * Template for image role description when editing with reference images.
 * Placeholders:
 * - {{referenceImageDescriptions}}: List of reference image descriptions
 * - {{targetImageIndex}}: Index of the target image (1-based)
 */
export const EDIT_IMAGE_ROLE_WITH_REFERENCES_TEMPLATE = `
{{referenceImageDescriptions}}
{{targetImageIndex}}枚目の画像: 編集対象の画像です。スタイル変更の指示がない限り、この画像の背景色やスタイルを維持しつつ、指示に従って編集してください。`

/**
 * Template for image role description when editing without reference images.
 */
export const EDIT_IMAGE_ROLE_NO_REFERENCES_TEMPLATE = `1枚目の画像: 編集対象の画像です。スタイル変更の指示がない限り、この画像の背景色やスタイルを維持しつつ、指示に従って編集してください。`

/**
 * Template for reference image description (used for each reference image).
 * Placeholders:
 * - {{index}}: Image index (1-based)
 */
export const REFERENCE_IMAGE_DESCRIPTION_TEMPLATE = `{{index}}枚目の画像: 参照画像です。スタイルや内容を参考にしてください。`

/**
 * Template for reference image description in generation mode.
 * Placeholders:
 * - {{index}}: Image index (1-based)
 */
export const GENERATE_REFERENCE_IMAGE_DESCRIPTION_TEMPLATE = `{{index}}枚目の画像: 参照画像です。スタイルや内容を参考にして新しい画像を生成してください。`

/**
 * Template for size constraint with specific dimensions.
 * Placeholders:
 * - {{width}}: Image width in pixels
 * - {{height}}: Image height in pixels
 */
export const SIZE_CONSTRAINT_WITH_DIMENSIONS_TEMPLATE = `【重要】出力画像は編集対象画像と同じサイズ（{{width}}x{{height}}ピクセル）およびアスペクト比を維持してください。参照画像のサイズやアスペクト比に影響されないでください。`

/**
 * Template for size constraint without specific dimensions.
 */
export const SIZE_CONSTRAINT_NO_DIMENSIONS_TEMPLATE = `【重要】出力画像は編集対象画像と同じサイズおよびアスペクト比を維持してください。参照画像のサイズやアスペクト比に影響されないでください。`

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Replace placeholders in a template string with provided values.
 * Placeholders are in the format {{key}}.
 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  let result = template
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
  }
  return result
}

/**
 * Clean up a filled template by removing empty sections and normalizing whitespace.
 */
function cleanFilledTemplate(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim()
}

// ============================================================================
// OCR Processing
// ============================================================================

/**
 * Convert OcrResult to formatted text for prompt inclusion.
 * Formats text blocks with position information for better context.
 */
function formatOcrResultForPrompt(ocrResult: OcrResult): string {
  if (!ocrResult.textBlocks || ocrResult.textBlocks.length === 0) {
    return ''
  }

  // Use fullText if available, otherwise concatenate text blocks
  if (ocrResult.fullText) {
    return ocrResult.fullText
  }

  return ocrResult.textBlocks.map((block) => block.text).join('\n')
}

// ============================================================================
// Image Generation - Prompt Builders
// ============================================================================

export function buildEditImagePrompt(request: ImageEditRequest): string {
  const { prompt, basePrompt, referenceImageDataUrls, ocrResult } = request

  // Build image role description
  let imageRoleDescription: string
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    const referenceDescriptions = referenceImageDataUrls
      .map((_, i) => fillTemplate(REFERENCE_IMAGE_DESCRIPTION_TEMPLATE, { index: i + 1 }))
      .join('\n')
    imageRoleDescription = fillTemplate(EDIT_IMAGE_ROLE_WITH_REFERENCES_TEMPLATE, {
      referenceImageDescriptions: referenceDescriptions,
      targetImageIndex: referenceImageDataUrls.length + 1
    })
  } else {
    imageRoleDescription = EDIT_IMAGE_ROLE_NO_REFERENCES_TEMPLATE
  }

  // Build OCR text section if available
  let ocrTextSection = ''
  if (ocrResult) {
    const ocrContent = formatOcrResultForPrompt(ocrResult)
    if (ocrContent) {
      ocrTextSection = fillTemplate(OCR_TEXT_TEMPLATE, { ocrContent })
    }
  }

  // Fill main template
  const filledTemplate = fillTemplate(EDIT_IMAGE_TEMPLATE, {
    basePrompt: basePrompt || '',
    prompt,
    imageRoleDescription,
    ocrText: ocrTextSection
  })

  const ret = cleanFilledTemplate(filledTemplate)
  console.log(ret)
  return ret
}

export function buildGenerateImagePrompt(request: ImageGenerateRequest): string {
  const { prompt, basePrompt, referenceImageDataUrls } = request

  // Build image role description
  let imageRoleDescription = ''
  if (referenceImageDataUrls && referenceImageDataUrls.length > 0) {
    const referenceDescriptions = referenceImageDataUrls
      .map((_, i) => fillTemplate(GENERATE_REFERENCE_IMAGE_DESCRIPTION_TEMPLATE, { index: i + 1 }))
      .join('\n')
    imageRoleDescription = `[画像の説明]\n${referenceDescriptions}`
  }

  // Fill main template
  const filledTemplate = fillTemplate(GENERATE_IMAGE_TEMPLATE, {
    basePrompt: basePrompt || '',
    prompt,
    imageRoleDescription
  })
  console.log(filledTemplate)
  return cleanFilledTemplate(filledTemplate)
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

  console.log(
    `[Gemini] Refined ${originalBlockCount} blocks to ${updatedBlocks.length} valid blocks`
  )

  return updatedBlocks
}
