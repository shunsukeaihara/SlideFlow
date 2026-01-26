import { useState, useCallback } from 'react'
import type { ReferenceImage } from '@/types/referenceImage'

/**
 * Custom hook for managing reference image selection state
 */
export function useReferenceSelection() {
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set())
  const [uploadedImages, setUploadedImages] = useState<ReferenceImage[]>([])

  const toggleReference = useCallback((id: string) => {
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const removeReference = useCallback((id: string) => {
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const clearAllReferences = useCallback(() => {
    setSelectedReferenceIds(new Set())
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string

        const img = new window.Image()
        img.onload = () => {
          const id = `upload-${Date.now()}-${Math.random()}`
          setUploadedImages((prev) => [
            ...prev,
            {
              id,
              dataUrl,
              name: file.name,
              isSlide: false,
              width: img.width,
              height: img.height
            }
          ])
          setSelectedReferenceIds((prev) => new Set([...prev, id]))
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const removeUploadedImage = useCallback((id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedReferenceIds(new Set())
    setUploadedImages([])
  }, [])

  return {
    selectedReferenceIds,
    uploadedImages,
    toggleReference,
    removeReference,
    clearAllReferences,
    handleFileUpload,
    removeUploadedImage,
    resetSelection
  }
}
