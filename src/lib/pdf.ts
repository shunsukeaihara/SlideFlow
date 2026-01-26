import * as pdfjs from 'pdfjs-dist'
import type { SlideImage } from '@/types/project'
import { v4 as uuidv4 } from 'uuid'

// PDF.jsのワーカーを設定（Viteのアセットインポートを使用）
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

export async function extractImagesFromPdf(file: File): Promise<SlideImage[]> {
  const arrayBuffer = await file.arrayBuffer()
  return extractImagesFromPdfData(arrayBuffer)
}

export async function extractImagesFromPdfBase64(base64: string): Promise<SlideImage[]> {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return extractImagesFromPdfData(bytes.buffer)
}

async function extractImagesFromPdfData(data: ArrayBuffer): Promise<SlideImage[]> {
  const pdf = await pdfjs.getDocument({ data }).promise
  const slides: SlideImage[] = []

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

    const dataUrl = canvas.toDataURL('image/webp', 0.90)

    slides.push({
      id: uuidv4(),
      pageNumber: i,
      originalDataUrl: dataUrl,
      currentDataUrl: dataUrl,
      width: viewport.width,
      height: viewport.height
    })
  }

  return slides
}

export async function createPdfFromImages(images: string[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')

  if (images.length === 0) {
    throw new Error('No images provided')
  }

  // 最初の画像からサイズを取得
  const firstImg = await loadImage(images[0])
  const pdf = new jsPDF({
    orientation: firstImg.width > firstImg.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [firstImg.width, firstImg.height]
  })

  for (let i = 0; i < images.length; i++) {
    const img = await loadImage(images[i])

    if (i > 0) {
      pdf.addPage([img.width, img.height], img.width > img.height ? 'landscape' : 'portrait')
    }

    pdf.addImage(images[i], 'PNG', 0, 0, img.width, img.height)
  }

  return pdf.output('blob')
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}
