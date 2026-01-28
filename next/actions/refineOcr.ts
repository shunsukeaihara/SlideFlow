'use server'

import { refineTesseractResults as serverRefineTesseractResults } from '../lib/gemini'
import type { OcrRefinementRequest } from '@/lib/gemini'
import type { OcrTextBlock } from '@/types/project'

export async function refineOcrAction(request: OcrRefinementRequest): Promise<OcrTextBlock[]> {
  return serverRefineTesseractResults(request)
}
