import type { OcrResult } from '../types/project'
import { extractTextWithTesseract } from './ocr-tesseract'
import { refineTesseractResults } from './ocr-gemini'

export async function extractText(dataUrl: string, apiKey: string): Promise<OcrResult> {
  // Step 1: Run Tesseract OCR to get text blocks with bounding boxes
  console.log('[OCR] Starting Tesseract OCR...')
  const tesseractBlocks = await extractTextWithTesseract(dataUrl)
  console.log('[OCR] Tesseract completed:', tesseractBlocks.length, 'text blocks')

  // Step 2: Refine with Gemini (optional - will use Tesseract results if this fails)
  let refinedBlocks = tesseractBlocks
  if (apiKey) {
    try {
      console.log('[OCR] Starting Gemini refinement...')
      refinedBlocks = await refineTesseractResults(tesseractBlocks, dataUrl, apiKey)
      console.log('[OCR] Gemini refinement completed')
    } catch (error) {
      console.warn('[OCR] Gemini refinement failed, using Tesseract results only:', error)
      // Continue with Tesseract results
    }
  } else {
    console.warn('[OCR] No API key provided, skipping Gemini refinement')
  }

  // Step 3: Generate full text from text blocks
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
