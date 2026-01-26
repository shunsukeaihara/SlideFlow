/**
 * Reference image data structure used for slide editing and generation
 */
export interface ReferenceImage {
  id: string
  dataUrl: string
  name: string
  isSlide: boolean
  slideId?: string
  width?: number
  height?: number
}
