import { create } from 'zustand'

// 処理タイプ
export type SlideProcessingType = 'edit' | 'ocr'

// スライド処理状態
export interface SlideProcessingState {
  type: SlideProcessingType
  status: string
  startedAt: number
}

// アップロード画像の型（ReferenceImageと互換性を持たせる）
export interface UploadedImage {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
  isSlide: boolean // 常にfalse（アップロード画像はスライドではない）
}

// スライド毎の編集状態
export interface SlideEditState {
  prompt: string
  selectedReferenceIds: Set<string>
  uploadedImages: UploadedImage[]
  showReferencePanel: boolean
}

// デフォルトの編集状態
const createDefaultEditState = (): SlideEditState => ({
  prompt: '',
  selectedReferenceIds: new Set(),
  uploadedImages: [],
  showReferencePanel: false
})

interface SlideEditorStoreState {
  // 処理状態
  processingSlides: Record<string, SlideProcessingState>

  // スライド毎の編集状態
  slideEditStates: Record<string, SlideEditState>

  // 処理アクション
  startSlideProcessing: (
    slideId: string,
    type: SlideProcessingType,
    status: string
  ) => boolean
  updateSlideProcessingStatus: (slideId: string, status: string) => void
  endSlideProcessing: (slideId: string) => void

  // 編集状態アクション
  getSlideEditState: (slideId: string) => SlideEditState
  setSlidePrompt: (slideId: string, prompt: string) => void
  toggleSlideReference: (slideId: string, refId: string) => void
  removeSlideReference: (slideId: string, refId: string) => void
  clearSlideReferences: (slideId: string) => void
  addSlideUploadedImage: (slideId: string, image: UploadedImage) => void
  removeSlideUploadedImage: (slideId: string, imageId: string) => void
  clearSlideEditState: (slideId: string) => void
  toggleSlideReferencePanel: (slideId: string) => void
}

export const useSlideEditorStore = create<SlideEditorStoreState>((set, get) => ({
  processingSlides: {},
  slideEditStates: {},

  // 処理開始（既に処理中ならfalseを返す）
  startSlideProcessing: (slideId, type, status) => {
    const { processingSlides } = get()
    if (processingSlides[slideId]) {
      return false
    }
    set({
      processingSlides: {
        ...processingSlides,
        [slideId]: { type, status, startedAt: Date.now() }
      }
    })
    return true
  },

  // ステータス更新
  updateSlideProcessingStatus: (slideId, status) => {
    const { processingSlides } = get()
    if (!processingSlides[slideId]) return
    set({
      processingSlides: {
        ...processingSlides,
        [slideId]: { ...processingSlides[slideId], status }
      }
    })
  },

  // 処理終了
  endSlideProcessing: (slideId) => {
    const { processingSlides } = get()
    const { [slideId]: _removed, ...remaining } = processingSlides
    void _removed // unused variable
    set({ processingSlides: remaining })
  },

  // 編集状態を取得（なければデフォルト値を返す）
  getSlideEditState: (slideId) => {
    const { slideEditStates } = get()
    return slideEditStates[slideId] || createDefaultEditState()
  },

  // プロンプト更新
  setSlidePrompt: (slideId, prompt) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: { ...currentState, prompt }
      }
    })
  },

  // 参照画像の選択/解除
  toggleSlideReference: (slideId, refId) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    const newIds = new Set(currentState.selectedReferenceIds)
    if (newIds.has(refId)) {
      newIds.delete(refId)
    } else {
      newIds.add(refId)
    }
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: { ...currentState, selectedReferenceIds: newIds }
      }
    })
  },

  // 参照画像の選択解除
  removeSlideReference: (slideId, refId) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    const newIds = new Set(currentState.selectedReferenceIds)
    newIds.delete(refId)
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: { ...currentState, selectedReferenceIds: newIds }
      }
    })
  },

  // 全参照選択クリア
  clearSlideReferences: (slideId) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: { ...currentState, selectedReferenceIds: new Set() }
      }
    })
  },

  // アップロード画像追加
  addSlideUploadedImage: (slideId, image) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    const newIds = new Set(currentState.selectedReferenceIds)
    newIds.add(image.id)
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: {
          ...currentState,
          uploadedImages: [...currentState.uploadedImages, image],
          selectedReferenceIds: newIds
        }
      }
    })
  },

  // アップロード画像削除
  removeSlideUploadedImage: (slideId, imageId) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    const newIds = new Set(currentState.selectedReferenceIds)
    newIds.delete(imageId)
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: {
          ...currentState,
          uploadedImages: currentState.uploadedImages.filter((img) => img.id !== imageId),
          selectedReferenceIds: newIds
        }
      }
    })
  },

  // 編集完了時に全状態クリア
  clearSlideEditState: (slideId) => {
    const { slideEditStates } = get()
    const { [slideId]: _removed, ...remaining } = slideEditStates
    void _removed // unused variable
    set({ slideEditStates: remaining })
  },

  // 参照パネルの表示切り替え
  toggleSlideReferencePanel: (slideId) => {
    const { slideEditStates } = get()
    const currentState = slideEditStates[slideId] || createDefaultEditState()
    set({
      slideEditStates: {
        ...slideEditStates,
        [slideId]: { ...currentState, showReferencePanel: !currentState.showReferencePanel }
      }
    })
  }
}))
