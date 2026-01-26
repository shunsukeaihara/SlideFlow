import { create } from 'zustand'
import type {
  Project,
  Slide,
  EditHistoryEntry,
  AppSettings,
  OcrResult,
  Image
} from '@/types/project'
import { v4 as uuidv4 } from 'uuid'

// Helper function to detect file type from data URL
function getFileTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/)
  return match ? match[1] : 'image/png'
}

// Helper function to get next image order
function getNextImageOrder(images: Record<string, Image>): number {
  const orders = Object.values(images).map((img) => img.order)
  return orders.length > 0 ? Math.max(...orders) + 1 : 0
}

interface ProjectState {
  project: Project | null
  selectedSlideId: string | null
  isLoading: boolean
  appSettings: AppSettings

  setProject: (project: Project | null) => void
  setSelectedSlide: (slideId: string | null) => void
  setLoading: (loading: boolean) => void

  updateSlideImage: (slideId: string, newImageDataUrl: string) => void
  addEditHistory: (
    slideId: string,
    entry: {
      prompt: string
      resultImageDataUrl: string
      referenceImages?: Array<{ name: string; dataUrl: string; width: number; height: number }>
      existingReferenceImageIds?: string[]
    }
  ) => void
  revertToHistory: (slideId: string, historyId: string) => void

  setApiKey: (apiKey: string) => void
  setSystemPrompt: (systemPrompt: string) => void
  loadApiKey: () => void

  createProject: (
    name: string,
    slides: Array<{
      imageDataUrl: string
      width: number
      height: number
    }>
  ) => Project

  // スライドの並べ替えと追加
  reorderSlides: (activeId: string, overId: string) => void
  addSlide: (
    slideData: { imageDataUrl: string; width: number; height: number },
    insertIndex: number,
    initialHistory?: {
      prompt: string
      referenceImages?: Array<{ name: string; dataUrl: string; width: number; height: number }>
    }
  ) => void
  deleteSlide: (slideId: string) => void

  // OCR actions
  setSlideOcrResult: (slideId: string, ocrResult: OcrResult) => void
  clearSlideOcrResult: (slideId: string) => void
}

const defaultAppSettings: AppSettings = {
  apiKey: ''
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  selectedSlideId: null,
  isLoading: false,
  appSettings: defaultAppSettings,

  setProject: (project) => {
    set({ project, selectedSlideId: project?.slides[0]?.id ?? null })
  },

  setSelectedSlide: (slideId) => set({ selectedSlideId: slideId }),

  setLoading: (isLoading) => set({ isLoading }),

  updateSlideImage: (slideId, newImageDataUrl) => {
    const { project } = get()
    if (!project) return

    // Find the slide to get image dimensions
    const slide = project.slides.find((s) => s.id === slideId)
    if (!slide) return

    const currentImage = project.images[slide.image.currentImageId]
    if (!currentImage) return

    // Create new image data with unique ID
    const newImageId = uuidv4()
    const newImage: Image = {
      id: newImageId,
      order: getNextImageOrder(project.images),
      dataUrl: newImageDataUrl,
      fileType: getFileTypeFromDataUrl(newImageDataUrl),
      width: currentImage.width,
      height: currentImage.height
      // No ocrCache - it's a new image
    }

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        images: {
          ...project.images,
          [newImageId]: newImage
        },
        slides: project.slides.map((s) =>
          s.id === slideId
            ? {
                ...s,
                image: {
                  ...s.image,
                  currentImageId: newImageId
                }
              }
            : s
        )
      }
    })
  },

  addEditHistory: (slideId, entry) => {
    const { project } = get()
    if (!project) return

    const slide = project.slides.find((s) => s.id === slideId)
    if (!slide) return

    const currentImage = project.images[slide.image.currentImageId]
    if (!currentImage) return

    // Create new image data for the result
    const newImageId = uuidv4()
    const newImage: Image = {
      id: newImageId,
      order: getNextImageOrder(project.images),
      dataUrl: entry.resultImageDataUrl,
      fileType: getFileTypeFromDataUrl(entry.resultImageDataUrl),
      width: currentImage.width,
      height: currentImage.height
      // No ocrCache - it's a new image
    }

    // Add reference images to images dictionary and collect their IDs
    const newImages: Record<string, Image> = {
      [newImageId]: newImage
    }
    const referenceImageIds: string[] = [...(entry.existingReferenceImageIds || [])]

    if (entry.referenceImages && entry.referenceImages.length > 0) {
      entry.referenceImages.forEach((refImg) => {
        const refImageId = uuidv4()
        newImages[refImageId] = {
          id: refImageId,
          order: getNextImageOrder({ ...project.images, ...newImages }),
          dataUrl: refImg.dataUrl,
          fileType: getFileTypeFromDataUrl(refImg.dataUrl),
          width: refImg.width,
          height: refImg.height
        }
        referenceImageIds.push(refImageId)
      })
    }

    const newEntry: EditHistoryEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      sourceImageId: slide.image.currentImageId,
      prompt: entry.prompt,
      resultImageId: newImageId,
      referenceImageIds: referenceImageIds.length > 0 ? referenceImageIds : undefined
    }

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        images: {
          ...project.images,
          ...newImages
        },
        slides: project.slides.map((s) =>
          s.id === slideId
            ? {
                ...s,
                image: {
                  ...s.image,
                  currentImageId: newImageId
                },
                editHistory: [...s.editHistory, newEntry]
              }
            : s
        )
      }
    })
  },

  revertToHistory: (slideId, historyId) => {
    const { project } = get()
    if (!project) return

    const slide = project.slides.find((s) => s.id === slideId)
    if (!slide) return

    const historyEntry = slide.editHistory.find((h) => h.id === historyId)
    if (!historyEntry) return

    // Simply update the currentImageId to point to the history image
    // The image data (including ocrCache) is preserved in project.images
    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: project.slides.map((s) =>
          s.id === slideId
            ? {
                ...s,
                image: {
                  ...s.image,
                  currentImageId: historyEntry.resultImageId
                }
              }
            : s
        )
      }
    })
  },

  setApiKey: (apiKey) => {
    localStorage.setItem('slideflow-api-key', apiKey)
    set((state) => ({
      appSettings: { ...state.appSettings, apiKey }
    }))
  },

  loadApiKey: () => {
    const apiKey = localStorage.getItem('slideflow-api-key') || ''
    set((state) => ({
      appSettings: { ...state.appSettings, apiKey }
    }))
  },

  setSystemPrompt: (systemPrompt) => {
    const { project } = get()
    if (!project) return

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        settings: { ...project.settings, systemPrompt }
      }
    })
  },

  createProject: (name, slideData) => {
    const now = Date.now()
    const images: Record<string, Image> = {}
    let imageOrder = 0

    const newSlides: Slide[] = slideData.map((data, index) => {
      // Create image data for original and current (same initially)
      const imageId = uuidv4()

      images[imageId] = {
        id: imageId,
        order: imageOrder++,
        dataUrl: data.imageDataUrl,
        fileType: getFileTypeFromDataUrl(data.imageDataUrl),
        width: data.width,
        height: data.height
      }

      return {
        id: uuidv4(),
        pageNumber: index + 1,
        image: {
          id: uuidv4(),
          pageNumber: index + 1,
          originalImageId: imageId,
          currentImageId: imageId // 最初は同じ画像
        },
        editHistory: []
      }
    })

    const newProject: Project = {
      id: uuidv4(),
      name,
      createdAt: now,
      updatedAt: now,
      slides: newSlides,
      images,
      settings: {
        systemPrompt: ''
      }
    }
    return newProject
  },

  reorderSlides: (activeId, overId) => {
    const { project } = get()
    if (!project || activeId === overId) return

    const oldIndex = project.slides.findIndex((s) => s.id === activeId)
    const newIndex = project.slides.findIndex((s) => s.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const newSlides = [...project.slides]
    const [removed] = newSlides.splice(oldIndex, 1)
    newSlides.splice(newIndex, 0, removed)

    // ページ番号を振り直す
    const updatedSlides = newSlides.map((slide, index) => ({
      ...slide,
      pageNumber: index + 1
    }))

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: updatedSlides
      }
    })
  },

  addSlide: (slideData, insertIndex, initialHistory) => {
    const { project } = get()
    if (!project) return

    const newSlideId = uuidv4()

    // Create image data
    const originalImageId = uuidv4()
    const currentImageId = uuidv4()

    const newImage: Image = {
      id: originalImageId,
      order: getNextImageOrder(project.images),
      dataUrl: slideData.imageDataUrl,
      fileType: getFileTypeFromDataUrl(slideData.imageDataUrl),
      width: slideData.width,
      height: slideData.height
    }

    // Add reference images to images dictionary and collect their IDs
    const newImages: Record<string, Image> = {}
    const referenceImageIds: string[] = []

    if (initialHistory?.referenceImages && initialHistory.referenceImages.length > 0) {
      initialHistory.referenceImages.forEach((refImg) => {
        const refImageId = uuidv4()
        newImages[refImageId] = {
          id: refImageId,
          order: getNextImageOrder({ ...project.images, ...newImages }),
          dataUrl: refImg.dataUrl,
          fileType: getFileTypeFromDataUrl(refImg.dataUrl),
          width: refImg.width,
          height: refImg.height
        }
        referenceImageIds.push(refImageId)
      })
    }

    // 初期履歴エントリを作成（生成時のプロンプトと参照画像IDを保存）
    const editHistory: EditHistoryEntry[] = initialHistory
      ? [
          {
            id: uuidv4(),
            timestamp: Date.now(),
            sourceImageId: originalImageId,
            prompt: initialHistory.prompt,
            resultImageId: currentImageId,
            referenceImageIds: referenceImageIds.length > 0 ? referenceImageIds : undefined
          }
        ]
      : []

    const newSlide: Slide = {
      id: newSlideId,
      pageNumber: insertIndex + 1,
      image: {
        id: uuidv4(),
        pageNumber: insertIndex + 1,
        originalImageId,
        currentImageId
      },
      editHistory
    }

    const newSlides = [...project.slides]
    newSlides.splice(insertIndex, 0, newSlide)

    // ページ番号を振り直す
    const updatedSlides = newSlides.map((slide, index) => ({
      ...slide,
      pageNumber: index + 1,
      image: { ...slide.image, pageNumber: index + 1 }
    }))

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: updatedSlides,
        images: {
          ...project.images,
          [originalImageId]: newImage,
          [currentImageId]: newImage, // Same image initially
          ...newImages // Add reference images
        }
      },
      selectedSlideId: newSlideId
    })
  },

  deleteSlide: (slideId) => {
    const { project, selectedSlideId } = get()
    if (!project || project.slides.length <= 1) return

    const deleteIndex = project.slides.findIndex((s) => s.id === slideId)
    if (deleteIndex === -1) return

    const newSlides = project.slides.filter((s) => s.id !== slideId)

    // ページ番号を振り直す
    const updatedSlides = newSlides.map((slide, index) => ({
      ...slide,
      pageNumber: index + 1,
      image: { ...slide.image, pageNumber: index + 1 }
    }))

    // 選択中のスライドが削除された場合、隣のスライドを選択
    let newSelectedId = selectedSlideId
    if (selectedSlideId === slideId) {
      const newIndex = Math.min(deleteIndex, updatedSlides.length - 1)
      newSelectedId = updatedSlides[newIndex]?.id ?? null
    }

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: updatedSlides
      },
      selectedSlideId: newSelectedId
    })
  },

  setSlideOcrResult: (slideId, ocrResult) => {
    const { project } = get()
    if (!project) return

    const slide = project.slides.find((s) => s.id === slideId)
    if (!slide) return

    const currentImageId = slide.image.currentImageId
    const currentImage = project.images[currentImageId]
    if (!currentImage) return

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        images: {
          ...project.images,
          [currentImageId]: {
            ...currentImage,
            ocrCache: ocrResult
          }
        }
      }
    })
  },

  clearSlideOcrResult: (slideId) => {
    const { project } = get()
    if (!project) return

    const slide = project.slides.find((s) => s.id === slideId)
    if (!slide) return

    const currentImageId = slide.image.currentImageId
    const currentImage = project.images[currentImageId]
    if (!currentImage) return

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        images: {
          ...project.images,
          [currentImageId]: {
            ...currentImage,
            ocrCache: undefined
          }
        }
      }
    })
  }
}))
