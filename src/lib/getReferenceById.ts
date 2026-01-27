import type { Project, Slide, Image } from '@/types/project'
import type { ReferenceImage } from '@/types/referenceImage'

/**
 * Get reference image by ID from various sources
 * Supports: uploaded images, current slides, past reference images, and history images
 */
export function getReferenceById(
  id: string,
  project: Project | null,
  uploadedImages: ReferenceImage[],
  getCurrentImageData: (slide: Slide | undefined) => Image | undefined
): ReferenceImage | null {
  // Find in uploaded images
  const uploaded = uploadedImages.find((img) => img.id === id)
  if (uploaded) return uploaded

  if (!project) return null

  // Find in current slides
  if (id.startsWith('slide-')) {
    const slideId = id.replace('slide-', '')
    const slide = project.slides.find((s) => s.id === slideId)
    if (slide) {
      const imageData = getCurrentImageData(slide)
      return {
        id,
        dataUrl: imageData?.dataUrl || '',
        name: `スライド ${slide.pageNumber}`,
        isSlide: true,
        slideId: slide.id,
        width: imageData?.width,
        height: imageData?.height
      }
    }
  }

  // Find in uploaded reference images
  if (id.startsWith('image-')) {
    const imageId = id.replace('image-', '')
    const img = project.images[imageId]
    if (img) {
      return {
        id,
        dataUrl: img.dataUrl,
        name: `参照画像 #${img.order + 1}`,
        isSlide: false,
        width: img.width,
        height: img.height
      }
    }
  }

  // Find in history
  if (id.startsWith('history-')) {
    const entryId = id.replace('history-', '')
    for (const slide of project.slides) {
      const entry = slide.editHistory.find((e) => e.id === entryId)
      if (entry) {
        const img = project.images[entry.resultImageId]
        if (img) {
          const index = slide.editHistory.indexOf(entry)
          return {
            id,
            dataUrl: img.dataUrl,
            name: `スライド ${slide.pageNumber} - 履歴 ${index + 1}`,
            isSlide: false,
            width: img.width,
            height: img.height
          }
        }
        break
      }
    }
  }

  return null
}

/**
 * Get multiple reference images by IDs
 */
export function getReferencesByIds(
  ids: Set<string> | string[],
  project: Project | null,
  uploadedImages: ReferenceImage[],
  getCurrentImageData: (slide: Slide | undefined) => Image | undefined
): ReferenceImage[] {
  const idsArray = Array.isArray(ids) ? ids : Array.from(ids)
  return idsArray
    .map((id) => getReferenceById(id, project, uploadedImages, getCurrentImageData))
    .filter((ref): ref is ReferenceImage => ref !== null)
}
