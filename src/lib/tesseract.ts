import { createWorker, type Worker, PSM } from 'tesseract.js'
import type { OcrTextBlock } from '../types/project'
import { logger } from './logger'

export async function extractTextWithTesseract(dataUrl: string): Promise<OcrTextBlock[]> {
  let worker: Worker | null = null

  try {
    // Create Tesseract worker with Japanese and English language support
    logger.log('[Tesseract] Creating worker...')
    worker = await createWorker('jpn+eng', undefined, {
      logger: (m) => {
        logger.debug('[Tesseract]', m)
      }
    })

    // Set Tesseract parameters for better text detection
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT // Sparse text. Find as much text as possible in no particular order
      // preserve_interword_spaces: '1' // Preserve spaces between words if needed
    })

    // Perform OCR with blocks enabled to get bounding boxes
    logger.log('[Tesseract] Starting recognition...')
    const result = await worker.recognize(
      dataUrl,
      {
        rotateAuto: true
      },
      { blocks: true } // This is crucial for getting bounding boxes
    )

    logger.debug('[Tesseract] Recognition result:', result)

    // Extract paragraphs with bounding boxes from blocks structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any
    const textBlocks: OcrTextBlock[] = []

    if (data.blocks && Array.isArray(data.blocks)) {
      logger.log('[Tesseract] Found', data.blocks.length, 'blocks')

      for (const block of data.blocks) {
        if (!block.paragraphs) continue

        for (const paragraph of block.paragraphs) {
          if (!paragraph.lines || paragraph.lines.length === 0) continue

          // Collect all text from lines in this paragraph
          const paragraphTexts: string[] = []
          const lines: Array<{
            text: string
            bbox: { x: number; y: number; width: number; height: number }
          }> = []
          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          let totalConfidence = 0
          let wordCount = 0

          for (const line of paragraph.lines) {
            if (!line.words) continue

            const lineTexts: string[] = []
            let lineMinX = Infinity
            let lineMinY = Infinity
            let lineMaxX = -Infinity
            let lineMaxY = -Infinity

            for (const word of line.words) {
              if (word.text && word.text.trim() && word.bbox) {
                lineTexts.push(word.text.trim())

                // Calculate bounding box for this line
                lineMinX = Math.min(lineMinX, word.bbox.x0)
                lineMinY = Math.min(lineMinY, word.bbox.y0)
                lineMaxX = Math.max(lineMaxX, word.bbox.x1)
                lineMaxY = Math.max(lineMaxY, word.bbox.y1)

                // Calculate bounding box for entire paragraph
                minX = Math.min(minX, word.bbox.x0)
                minY = Math.min(minY, word.bbox.y0)
                maxX = Math.max(maxX, word.bbox.x1)
                maxY = Math.max(maxY, word.bbox.y1)

                totalConfidence += word.confidence
                wordCount++
              }
            }

            if (lineTexts.length > 0 && lineMinX !== Infinity) {
              const lineText = lineTexts.join(' ')
              paragraphTexts.push(lineText)
              lines.push({
                text: lineText,
                bbox: {
                  x: lineMinX,
                  y: lineMinY,
                  width: lineMaxX - lineMinX,
                  height: lineMaxY - lineMinY
                }
              })
            }
          }

          if (paragraphTexts.length > 0 && minX !== Infinity) {
            textBlocks.push({
              text: paragraphTexts.join('\n'),
              bbox: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
              },
              confidence: wordCount > 0 ? totalConfidence / wordCount : 0,
              lines
            })
          }
        }
      }

      logger.log('[Tesseract] Extracted', textBlocks.length, 'paragraphs from blocks')
    }

    if (textBlocks.length === 0) {
      // Fallback to simple text extraction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data as any
      if (data.text && data.text.trim()) {
        logger.log('[Tesseract] Fallback: creating single text block')
        textBlocks.push({
          text: data.text.trim(),
          bbox: {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          },
          confidence: data.confidence
        })
      } else {
        throw new Error('No text recognized in the image')
      }
    }

    logger.log('[Tesseract] Extracted', textBlocks.length, 'text blocks')

    return textBlocks
  } catch (error) {
    logger.error('Tesseract OCR error:', error)
    throw new Error(
      `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  } finally {
    // Always terminate the worker to free memory
    if (worker) {
      await worker.terminate()
    }
  }
}
