import type { ReferenceImage } from '@/types/referenceImage'
import type { Project } from '@/types/project'

/**
 * Convert reference image IDs to actual image IDs in the project
 * Returns both existing image IDs and new reference images to be added
 */
export function convertReferenceIdsToImageData(
  selectedReferences: ReferenceImage[],
  project: Project | null
): {
  existingImageIds: string[]
  newReferenceImages: Array<{
    name: string
    dataUrl: string
    width: number
    height: number
  }>
} {
  const existingImageIds: string[] = []
  const newReferenceImages: Array<{
    name: string
    dataUrl: string
    width: number
    height: number
  }> = []

  selectedReferences.forEach((ref) => {
    if (ref.id.startsWith('image-')) {
      // Already in project.images, just reference by ID
      existingImageIds.push(ref.id.replace('image-', ''))
    } else if (ref.id.startsWith('history-')) {
      // History image - find the result image ID
      const entryId = ref.id.replace('history-', '')
      for (const slide of project?.slides || []) {
        const entry = slide.editHistory.find((e) => e.id === entryId)
        if (entry) {
          existingImageIds.push(entry.resultImageId)
          break
        }
      }
    } else if (ref.id.startsWith('slide-')) {
      // Current slide image
      const slideId = ref.id.replace('slide-', '')
      const slide = project?.slides.find((s) => s.id === slideId)
      if (slide) {
        existingImageIds.push(slide.image.currentImageId)
      }
    } else if (ref.id.startsWith('upload-') && ref.width && ref.height) {
      // New uploaded image - add to images dictionary
      newReferenceImages.push({
        name: ref.name,
        dataUrl: ref.dataUrl,
        width: ref.width,
        height: ref.height
      })
    }
  })

  return {
    existingImageIds,
    newReferenceImages
  }
}

/**
 * Build full prompt with reference image descriptions
 */
export function buildPromptWithReferences(
  prompt: string,
  selectedReferences: ReferenceImage[]
): string {
  if (selectedReferences.length === 0) {
    return prompt
  }

  const refDescription = selectedReferences
    .map((ref, i) => `参照画像${i + 1}: ${ref.name}`)
    .join('\n')

  return `${prompt}\n\n【参照画像】\n${refDescription}\n\n上記の参照画像のスタイルや内容を参考にして編集してください。`
}
