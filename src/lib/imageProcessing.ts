import { decode as decodeJpeg } from '@jsquash/jpeg'
import { decode as decodePng } from '@jsquash/png'
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp'
import resize from '@jsquash/resize'

// Constants for image constraints
const MAX_WIDTH = 1376
const MAX_HEIGHT = 768
const WEBP_QUALITY = 90

/**
 * Decode an image from binary data based on MIME type
 */
async function decodeImage(data: ArrayBuffer, mimeType: string): Promise<ImageData> {
  switch (mimeType) {
    case 'image/jpeg':
      return decodeJpeg(data)
    case 'image/png':
      return decodePng(data)
    case 'image/webp':
      return decodeWebp(data)
    default:
      // Try WebP decoder for unknown types (Gemini may return without proper mimeType)
      return decodeWebp(data)
  }
}

/**
 * Calculate new dimensions maintaining aspect ratio within max bounds
 */
function calculateResizeDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; needsResize: boolean } {
  // If already within bounds, no resize needed
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height, needsResize: false }
  }

  // Calculate scale factors for both dimensions
  const widthRatio = maxWidth / width
  const heightRatio = maxHeight / height

  // Use the smaller ratio to ensure both dimensions fit within bounds
  const scale = Math.min(widthRatio, heightRatio)

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    needsResize: true
  }
}

/**
 * Convert Uint8Array to base64 string
 * Works in both browser and Node.js
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  // Check if running in Node.js
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8Array).toString('base64')
  }
  // Browser environment
  let binary = ''
  const len = uint8Array.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array
 * Works in both browser and Node.js
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Check if running in Node.js
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  // Browser environment
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Process a Gemini API image response:
 * 1. Decode the image (supports JPEG, PNG, WebP)
 * 2. Resize to max 1376x768 if needed (maintaining aspect ratio)
 * 3. Encode as WebP with quality 90
 *
 * @param base64Data - Base64 encoded image data from Gemini
 * @param mimeType - MIME type of the source image
 * @returns Data URL of the processed image (always WebP format)
 */
export async function processGeminiImage(base64Data: string, mimeType: string): Promise<string> {
  // Convert base64 to ArrayBuffer
  const uint8Array = base64ToUint8Array(base64Data)
  // Create a new ArrayBuffer by copying the data to avoid SharedArrayBuffer issues
  const arrayBuffer = new ArrayBuffer(uint8Array.byteLength)
  new Uint8Array(arrayBuffer).set(uint8Array)

  // Decode the image
  let imageData = await decodeImage(arrayBuffer, mimeType)

  // Calculate resize dimensions
  const { width, height, needsResize } = calculateResizeDimensions(
    imageData.width,
    imageData.height,
    MAX_WIDTH,
    MAX_HEIGHT
  )

  // Resize if needed
  if (needsResize) {
    imageData = await resize(imageData, {
      width,
      height
    })
  }

  // Encode as WebP
  const webpBuffer = await encodeWebp(imageData, {
    quality: WEBP_QUALITY
  })

  // Convert to data URL
  const webpBase64 = uint8ArrayToBase64(new Uint8Array(webpBuffer))
  return `data:image/webp;base64,${webpBase64}`
}
