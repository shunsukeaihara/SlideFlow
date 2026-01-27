import * as pdfjs from 'pdfjs-dist'

// PDF.js worker configuration
// Use unpkg CDN for compatibility with both Vite and Next.js/Turbopack
// Note: cdnjs doesn't have all versions, unpkg mirrors npm directly
const PDFJS_VERSION = '5.4.530'
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`

interface ExtractedImageData {
  imageDataUrl: string
  width: number
  height: number
}

export async function extractImagesFromPdf(file: File): Promise<ExtractedImageData[]> {
  const arrayBuffer = await file.arrayBuffer()
  return extractImagesFromPdfData(arrayBuffer)
}

export async function extractImagesFromPdfBase64(base64: string): Promise<ExtractedImageData[]> {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return extractImagesFromPdfData(bytes.buffer)
}

async function extractImagesFromPdfData(data: ArrayBuffer): Promise<ExtractedImageData[]> {
  const pdf = await pdfjs.getDocument({ data }).promise
  const slides: ExtractedImageData[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.0 })

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Failed to get canvas context')

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: context,
      viewport,
      canvas
    }).promise

    const dataUrl = canvas.toDataURL('image/webp', 0.9)

    slides.push({
      imageDataUrl: dataUrl,
      width: viewport.width,
      height: viewport.height
    })
  }

  return slides
}

interface SlideForPdf {
  imageDataUrl: string
  originalWidth: number
  originalHeight: number
}

export async function createPdfFromImages(slides: SlideForPdf[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')

  if (slides.length === 0) {
    throw new Error('No images provided')
  }

  // 最初のスライドのオリジナルサイズでPDFを初期化
  const firstSlide = slides[0]
  const pdf = new jsPDF({
    orientation: firstSlide.originalWidth > firstSlide.originalHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [firstSlide.originalWidth, firstSlide.originalHeight]
  })

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const { originalWidth, originalHeight } = slide

    if (i > 0) {
      pdf.addPage(
        [originalWidth, originalHeight],
        originalWidth > originalHeight ? 'landscape' : 'portrait'
      )
    }

    // 画像をオリジナルサイズに合わせて配置（アスペクト比を維持してフィット）
    pdf.addImage(slide.imageDataUrl, 'PNG', 0, 0, originalWidth, originalHeight)
  }

  return pdf.output('blob')
}
