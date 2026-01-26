import { createWorker, type Worker } from 'tesseract.js'
import type { OcrTextBlock } from '../types/project'

interface TesseractWord {
  text: string
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
  confidence: number
}

export async function extractTextWithTesseract(dataUrl: string): Promise<OcrTextBlock[]> {
  let worker: Worker | null = null

  try {
    // Create Tesseract worker with Japanese and English language support
    worker = await createWorker(['jpn', 'eng'], 1, {
      logger: (m) => {
        console.log('[Tesseract]', m)
      }
    })

    // Perform OCR
    const result = await worker.recognize(dataUrl)

    // Extract text blocks with bounding boxes at word level
    // Using type assertion since the types may not be fully accurate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const words = (result.data as any).words as TesseractWord[]
    const textBlocks: OcrTextBlock[] = words.map((word: TesseractWord) => ({
      text: word.text,
      bbox: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0
      },
      confidence: word.confidence
    }))

    return textBlocks
  } catch (error) {
    console.error('Tesseract OCR error:', error)
    throw new Error(`Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // Always terminate the worker to free memory
    if (worker) {
      await worker.terminate()
    }
  }
}
