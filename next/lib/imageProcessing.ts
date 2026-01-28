import sharp from 'sharp'

// Constants for image constraints
const MAX_WIDTH = 1376
const MAX_HEIGHT = 768
const WEBP_QUALITY = 90

/**
 * Process a Gemini API image response on the server side using sharp:
 * 1. Decode the image (supports JPEG, PNG, WebP)
 * 2. Resize to max 1376x768 if needed (maintaining aspect ratio)
 * 3. Encode as WebP with quality 90
 *
 * @param base64Data - Base64 encoded image data from Gemini
 * @param _mimeType - MIME type of the source image (unused, sharp auto-detects)
 * @returns Data URL of the processed image (always WebP format)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function processGeminiImage(base64Data: string, _mimeType: string): Promise<string> {
  // Convert base64 to Buffer
  const inputBuffer = Buffer.from(base64Data, 'base64')

  // Process with sharp: resize and convert to WebP
  const outputBuffer = await sharp(inputBuffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside', // Maintain aspect ratio, fit within bounds
      withoutEnlargement: true // Don't upscale if smaller than max
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  // Convert to data URL
  const webpBase64 = outputBuffer.toString('base64')
  return `data:image/webp;base64,${webpBase64}`
}
