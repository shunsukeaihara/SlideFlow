import { create } from 'zustand'
import type { Project, Slide, EditHistoryEntry, AppSettings, ReferenceImageData } from '@/types/project'
import { v4 as uuidv4 } from 'uuid'

interface ProjectState {
  project: Project | null
  selectedSlideId: string | null
  isLoading: boolean
  appSettings: AppSettings

  setProject: (project: Project | null) => void
  setSelectedSlide: (slideId: string | null) => void
  setLoading: (loading: boolean) => void

  updateSlideImage: (slideId: string, newImageDataUrl: string) => void
  addEditHistory: (slideId: string, entry: Omit<EditHistoryEntry, 'id' | 'timestamp'>) => void
  revertToHistory: (slideId: string, historyId: string) => void

  setApiKey: (apiKey: string) => void
  setSystemPrompt: (systemPrompt: string) => void
  loadApiKey: () => void

  createProject: (name: string, slides: Omit<Slide, 'id' | 'editHistory'>[]) => Project

  // スライドの並べ替えと追加
  reorderSlides: (activeId: string, overId: string) => void
  addSlide: (
    slideData: { imageDataUrl: string; width: number; height: number },
    insertIndex: number,
    initialHistory?: {
      prompt: string
      referenceImages?: ReferenceImageData[]
    }
  ) => void
  deleteSlide: (slideId: string) => void
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

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: project.slides.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                image: { ...slide.image, currentDataUrl: newImageDataUrl }
              }
            : slide
        )
      }
    })
  },

  addEditHistory: (slideId, entry) => {
    const { project } = get()
    if (!project) return

    const newEntry: EditHistoryEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: Date.now()
    }

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: project.slides.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                image: { ...slide.image, currentDataUrl: entry.resultImageDataUrl },
                editHistory: [...slide.editHistory, newEntry]
              }
            : slide
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

    set({
      project: {
        ...project,
        updatedAt: Date.now(),
        slides: project.slides.map((s) =>
          s.id === slideId
            ? {
                ...s,
                image: { ...s.image, currentDataUrl: historyEntry.resultImageDataUrl }
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

  createProject: (name, slides) => {
    const now = Date.now()
    const newProject: Project = {
      id: uuidv4(),
      name,
      createdAt: now,
      updatedAt: now,
      slides: slides.map((slide, index) => ({
        ...slide,
        id: uuidv4(),
        pageNumber: index + 1,
        editHistory: []
      })),
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

    // 初期履歴エントリを作成（生成時のプロンプトと参照画像を保存）
    const editHistory: EditHistoryEntry[] = initialHistory
      ? [
          {
            id: uuidv4(),
            timestamp: Date.now(),
            sourceImageDataUrl: slideData.imageDataUrl,
            prompt: initialHistory.prompt,
            resultImageDataUrl: slideData.imageDataUrl,
            referenceImages: initialHistory.referenceImages
          }
        ]
      : []

    const newSlide: Slide = {
      id: newSlideId,
      pageNumber: insertIndex + 1,
      image: {
        id: uuidv4(),
        pageNumber: insertIndex + 1,
        originalDataUrl: slideData.imageDataUrl,
        currentDataUrl: slideData.imageDataUrl,
        width: slideData.width,
        height: slideData.height
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
        slides: updatedSlides
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
  }
}))
