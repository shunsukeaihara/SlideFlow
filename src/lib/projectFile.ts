import JSZip from 'jszip'
import type { Project } from '@/types/project'

const PROJECT_FILE_NAME = 'project.json'
const PROJECT_FILE_EXTENSION = '.enlm'
const PROJECT_VERSION = 2
const IMAGES_FOLDER = 'images/'
const IMAGE_EXTENSION = '.webp'

export async function saveProjectToZip(project: Project): Promise<Blob> {
  const zip = new JSZip()

  // Version 2フォーマット: 画像をバイナリとして分離保存
  const projectCopy: Project = {
    ...project,
    version: PROJECT_VERSION,
    slides: await Promise.all(
      project.slides.map(async (slide) => ({
        ...slide,
        image: {
          ...slide.image,
          originalImagePath: `${IMAGES_FOLDER}slide-${slide.pageNumber}-original${IMAGE_EXTENSION}`,
          currentImagePath: `${IMAGES_FOLDER}slide-${slide.pageNumber}-current${IMAGE_EXTENSION}`,
          originalDataUrl: '', // Clear for version 2
          currentDataUrl: '' // Clear for version 2
        },
        editHistory: await Promise.all(
          slide.editHistory.map(async (entry, histIdx) => ({
            ...entry,
            sourceImagePath: `${IMAGES_FOLDER}slide-${slide.pageNumber}-hist-${histIdx}-source${IMAGE_EXTENSION}`,
            resultImagePath: `${IMAGES_FOLDER}slide-${slide.pageNumber}-hist-${histIdx}-result${IMAGE_EXTENSION}`,
            sourceImageDataUrl: '', // Clear for version 2
            resultImageDataUrl: '', // Clear for version 2
            referenceImages: entry.referenceImages
              ? await Promise.all(
                  entry.referenceImages.map(async (ref, refIdx) => ({
                    ...ref,
                    imagePath: `${IMAGES_FOLDER}slide-${slide.pageNumber}-hist-${histIdx}-ref-${refIdx}${IMAGE_EXTENSION}`,
                    dataUrl: '' // Clear for version 2
                  }))
                )
              : undefined
          }))
        )
      }))
    )
  }

  // 画像ファイルをZIPに追加
  for (const slide of project.slides) {
    // Original and current images
    await addImageToZip(
      zip,
      `${IMAGES_FOLDER}slide-${slide.pageNumber}-original${IMAGE_EXTENSION}`,
      slide.image.originalDataUrl
    )
    await addImageToZip(
      zip,
      `${IMAGES_FOLDER}slide-${slide.pageNumber}-current${IMAGE_EXTENSION}`,
      slide.image.currentDataUrl
    )

    // Edit history images
    for (let histIdx = 0; histIdx < slide.editHistory.length; histIdx++) {
      const entry = slide.editHistory[histIdx]
      await addImageToZip(
        zip,
        `${IMAGES_FOLDER}slide-${slide.pageNumber}-hist-${histIdx}-source${IMAGE_EXTENSION}`,
        entry.sourceImageDataUrl
      )
      await addImageToZip(
        zip,
        `${IMAGES_FOLDER}slide-${slide.pageNumber}-hist-${histIdx}-result${IMAGE_EXTENSION}`,
        entry.resultImageDataUrl
      )

      // Reference images
      if (entry.referenceImages) {
        for (let refIdx = 0; refIdx < entry.referenceImages.length; refIdx++) {
          const ref = entry.referenceImages[refIdx]
          await addImageToZip(
            zip,
            `${IMAGES_FOLDER}slide-${slide.pageNumber}-hist-${histIdx}-ref-${refIdx}${IMAGE_EXTENSION}`,
            ref.dataUrl
          )
        }
      }
    }
  }

  // プロジェクトデータをJSONとして追加
  zip.file(PROJECT_FILE_NAME, JSON.stringify(projectCopy, null, 2))

  // ZIP圧縮（最高圧縮率）
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  })

  return blob
}

async function addImageToZip(zip: JSZip, path: string, dataUrl: string): Promise<void> {
  if (!dataUrl) return

  // DataURLからバイナリに変換
  const base64Data = dataUrl.split(',')[1]
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  zip.file(path, bytes)
}

export async function loadProjectFromZip(file: File): Promise<Project> {
  const zip = await JSZip.loadAsync(file)
  return loadProjectFromZipData(zip)
}

export async function loadProjectFromZipBase64(base64: string): Promise<Project> {
  const zip = await JSZip.loadAsync(base64, { base64: true })
  return loadProjectFromZipData(zip)
}

async function loadProjectFromZipData(zip: JSZip): Promise<Project> {
  const projectFile = zip.file(PROJECT_FILE_NAME)
  if (!projectFile) {
    throw new Error('Invalid project file: project.json not found')
  }

  const content = await projectFile.async('string')
  const project: Project = JSON.parse(content)

  // Version 1 (legacy): DataURLsが直接含まれている
  // Version 2: 画像はバイナリとして分離保存されている
  const version = project.version || 1

  if (version === 2) {
    // Version 2: バイナリ画像を読み込んでDataURLに変換
    project.slides = await Promise.all(
      project.slides.map(async (slide) => ({
        ...slide,
        image: {
          ...slide.image,
          originalDataUrl: slide.image.originalImagePath
            ? await loadImageFromZip(zip, slide.image.originalImagePath)
            : slide.image.originalDataUrl,
          currentDataUrl: slide.image.currentImagePath
            ? await loadImageFromZip(zip, slide.image.currentImagePath)
            : slide.image.currentDataUrl
        },
        editHistory: await Promise.all(
          slide.editHistory.map(async (entry) => ({
            ...entry,
            sourceImageDataUrl: entry.sourceImagePath
              ? await loadImageFromZip(zip, entry.sourceImagePath)
              : entry.sourceImageDataUrl,
            resultImageDataUrl: entry.resultImagePath
              ? await loadImageFromZip(zip, entry.resultImagePath)
              : entry.resultImageDataUrl,
            referenceImages: entry.referenceImages
              ? await Promise.all(
                  entry.referenceImages.map(async (ref) => ({
                    ...ref,
                    dataUrl: ref.imagePath ? await loadImageFromZip(zip, ref.imagePath) : ref.dataUrl
                  }))
                )
              : undefined
          }))
        )
      }))
    )
  }

  return project
}

async function loadImageFromZip(zip: JSZip, path: string): Promise<string> {
  const imageFile = zip.file(path)
  if (!imageFile) {
    throw new Error(`Image file not found: ${path}`)
  }

  const bytes = await imageFile.async('uint8array')

  // Uint8ArrayからBase64に変換
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  // WebP形式と仮定（Version 2ではすべてWebP）
  return `data:image/webp;base64,${base64}`
}

export function getProjectFileName(projectName: string): string {
  return `${projectName}${PROJECT_FILE_EXTENSION}`
}

export function isProjectFile(fileName: string): boolean {
  return fileName.endsWith(PROJECT_FILE_EXTENSION)
}
