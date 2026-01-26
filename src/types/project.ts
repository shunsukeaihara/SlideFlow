export interface SlideImage {
  id: string
  pageNumber: number
  originalDataUrl: string
  currentDataUrl: string
  // Version 2 fields (for binary storage)
  originalImagePath?: string
  currentImagePath?: string
  width: number
  height: number
}

export interface ReferenceImageData {
  name: string
  dataUrl: string
  // Version 2 fields (for binary storage)
  imagePath?: string
}

export interface EditHistoryEntry {
  id: string
  timestamp: number
  sourceImageDataUrl: string
  prompt: string
  resultImageDataUrl: string
  // Version 2 fields (for binary storage)
  sourceImagePath?: string
  resultImagePath?: string
  referenceImages?: ReferenceImageData[]
}

export interface OcrTextBlock {
  text: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence?: number
}

export interface OcrResult {
  textBlocks: OcrTextBlock[]
  fullText: string
  metadata: {
    tesseractRaw: OcrTextBlock[]
    engine: 'tesseract+gemini'
    timestamp: number
  }
}

export interface Slide {
  id: string
  pageNumber: number
  image: SlideImage
  editHistory: EditHistoryEntry[]
  ocrCache?: OcrResult
}

export interface ProjectSettings {
  systemPrompt: string
}

export interface Project {
  version?: number // 1 = legacy (Base64), 2 = binary storage
  id: string
  name: string
  createdAt: number
  updatedAt: number
  slides: Slide[]
  settings: ProjectSettings
}

export interface AppSettings {
  apiKey: string
}
