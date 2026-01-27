export interface Image {
  id: string
  order: number
  dataUrl: string
  fileType: string // 'image/png', 'image/jpeg', etc.
  // Version 2 fields (for binary storage)
  imagePath?: string
  width: number
  height: number
  ocrCache?: OcrResult
}

export interface EditHistoryEntry {
  id: string
  timestamp: number
  sourceImageId: string
  prompt: string
  resultImageId: string
  referenceImageIds?: string[] // IDs of images in project.images dictionary
}

export interface SlideImage {
  id: string
  pageNumber: number
  originalImageId: string
  currentImageId: string
}

export interface OcrTextBlock {
  text: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence?: number
  lines?: Array<{
    text: string
    bbox: { x: number; y: number; width: number; height: number }
  }>
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
}

export interface ProjectSettings {
  basePrompt: string
}

export interface Project {
  version?: number // 1 = legacy (Base64), 2 = binary storage
  id: string
  name: string
  createdAt: number
  updatedAt: number
  slides: Slide[]
  images: Record<string, Image> // All images keyed by ID, stored as sorted dictionary
  settings: ProjectSettings
}

export interface AppSettings {
  apiKey: string
}
