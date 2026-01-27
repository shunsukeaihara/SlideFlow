import type { OcrResult } from '../types/project'
import type { GeminiAPI } from '../context/GeminiContext'
import { extractTextWithTesseract } from './tesseract'

export interface OcrOptions {
  onProgress?: (status: string) => void
}

export async function extractText(
  dataUrl: string,
  gemini: GeminiAPI,
  options?: OcrOptions
): Promise<OcrResult> {
  const { onProgress } = options || {}

  // Step 1: Run Tesseract OCR to get text blocks with bounding boxes
  console.log('[OCR] Starting Tesseract OCR...')
  onProgress?.('Tesseract OCR実行中...')
  const tesseractBlocks = await extractTextWithTesseract(dataUrl)
  console.log('[OCR] Tesseract completed:', tesseractBlocks.length, 'text blocks')

  // Step 2: Refine with Gemini (optional - will use Tesseract results if this fails)
  let refinedBlocks = tesseractBlocks
  try {
    console.log('[OCR] Starting Gemini refinement...')
    onProgress?.('GeminiでOCR精度向上中...')
    refinedBlocks = await gemini.refineTesseractResults({
      tesseractBlocks,
      imageDataUrl: dataUrl
    })
    console.log('[OCR] Gemini refinement completed')
  } catch (error) {
    console.warn('[OCR] Gemini refinement failed, using Tesseract results only:', error)
    // Continue with Tesseract results
  }

  // Step 3: Generate full text from text blocks
  onProgress?.('OCR結果を処理中...')
  const fullText = refinedBlocks.map((block) => block.text).join(' ')

  return {
    textBlocks: refinedBlocks,
    fullText,
    metadata: {
      tesseractRaw: tesseractBlocks,
      engine: 'tesseract+gemini',
      timestamp: Date.now()
    }
  }
}
