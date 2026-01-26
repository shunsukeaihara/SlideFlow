import { useMemo } from 'react'
import type { Project, Slide } from '@/types/project'
import type { ReferenceImage } from '@/types/referenceImage'

interface UseReferenceImagesOptions {
  project: Project | null
  selectedSlideId: string | null
  uploadedImages: ReferenceImage[]
  getCurrentImageData: (slide: Slide | undefined) => any
}

/**
 * Custom hook to build reference images for selection
 */
export function useReferenceImages({
  project,
  selectedSlideId,
  uploadedImages,
  getCurrentImageData
}: UseReferenceImagesOptions) {
  // Current slide references (excluding selected slide)
  const currentSlideReferences: ReferenceImage[] = useMemo(
    () =>
      project?.slides
        .filter((slide) => slide.id !== selectedSlideId)
        .map((slide) => {
          const imageData = getCurrentImageData(slide)
          return {
            id: `slide-${slide.id}`,
            dataUrl: imageData?.dataUrl || '',
            name: `スライド ${slide.pageNumber}`,
            isSlide: true,
            slideId: slide.id,
            width: imageData?.width,
            height: imageData?.height
          }
        }) || [],
    [project?.slides, selectedSlideId, getCurrentImageData]
  )

  // Past reference images (from edit history)
  const pastReferenceImages: ReferenceImage[] = useMemo(() => {
    const referenceImageIds = new Set<string>()
    project?.slides.forEach((slide) => {
      slide.editHistory.forEach((entry) => {
        entry.referenceImageIds?.forEach((id) => {
          referenceImageIds.add(id)
        })
      })
    })

    const slideImageIds = new Set<string>()
    project?.slides.forEach((slide) => {
      slideImageIds.add(slide.image.originalImageId)
      slideImageIds.add(slide.image.currentImageId)
      slide.editHistory.forEach((entry) => {
        slideImageIds.add(entry.resultImageId)
        slideImageIds.add(entry.sourceImageId)
      })
    })

    return Array.from(referenceImageIds)
      .filter((id) => !slideImageIds.has(id))
      .map((id) => {
        const img = project?.images[id]
        if (!img) return null
        return {
          id: `image-${img.id}`,
          dataUrl: img.dataUrl,
          name: `参照画像 #${img.order + 1}`,
          isSlide: false,
          width: img.width,
          height: img.height
        } as ReferenceImage
      })
      .filter((img): img is ReferenceImage => img !== null)
  }, [project?.slides, project?.images])

  // History images (all result images from edit history)
  const historyImages: ReferenceImage[] = useMemo(() => {
    const images: ReferenceImage[] = []
    project?.slides.forEach((slide) => {
      slide.editHistory.forEach((entry, index) => {
        const img = project.images[entry.resultImageId]
        if (img) {
          images.push({
            id: `history-${entry.id}`,
            dataUrl: img.dataUrl,
            name: `スライド ${slide.pageNumber} - 履歴 ${index + 1}`,
            isSlide: false,
            width: img.width,
            height: img.height
          })
        }
      })
    })
    return images
  }, [project?.slides, project?.images])

  // All references combined
  const allReferences: ReferenceImage[] = useMemo(
    () => [...currentSlideReferences, ...pastReferenceImages, ...uploadedImages, ...historyImages],
    [currentSlideReferences, pastReferenceImages, uploadedImages, historyImages]
  )

  return {
    currentSlideReferences,
    pastReferenceImages,
    historyImages,
    allReferences
  }
}
