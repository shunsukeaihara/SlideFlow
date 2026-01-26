import { useCallback } from 'react'
import type { Project, Slide, Image } from '@/types/project'

/**
 * Custom hook for image data operations
 */
export function useImageOperations(project: Project | null) {
  const getCurrentImageData = useCallback(
    (slide: Slide | undefined): Image | undefined => {
      if (!slide || !project?.images) return undefined
      return project.images[slide.image.currentImageId]
    },
    [project?.images]
  )

  const getOriginalImageData = useCallback(
    (slide: Slide | undefined): Image | undefined => {
      if (!slide || !project?.images) return undefined
      return project.images[slide.image.originalImageId]
    },
    [project?.images]
  )

  return {
    getCurrentImageData,
    getOriginalImageData
  }
}
