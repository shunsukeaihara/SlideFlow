'use server'

import { editImage as serverEditImage } from '../lib/gemini-server'
import type { ImageEditRequest } from '@/lib/gemini'

export async function editImageAction(request: ImageEditRequest): Promise<string> {
  return serverEditImage(request)
}
