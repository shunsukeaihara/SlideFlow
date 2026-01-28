'use server'

import { generateImageFromReference as serverGenerateImageFromReference } from '../lib/gemini'
import type { ImageGenerateRequest } from '@/lib/gemini'

export async function generateImageAction(request: ImageGenerateRequest): Promise<string> {
  return serverGenerateImageFromReference(request)
}
