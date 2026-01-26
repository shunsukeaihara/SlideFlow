import JSZip from 'jszip'
import type { Project, Image } from '@/types/project'

const PROJECT_FILE_NAME = 'project.json'
const PROJECT_FILE_EXTENSION = '.sfpj'
const PROJECT_VERSION = 2
const IMAGES_FOLDER = 'images/'
const IMAGE_EXTENSION = '.webp'

export async function saveProjectToZip(project: Project): Promise<Blob> {
  const zip = new JSZip()

  // Version 2フォーマット: 画像をバイナリとして分離保存
  // imagesのdataUrlを空にしてpathを設定
  const imagesWithPaths: Record<string, Image> = {}
  for (const [id, image] of Object.entries(project.images)) {
    const imagePath = `${IMAGES_FOLDER}image-${id}${IMAGE_EXTENSION}`

    imagesWithPaths[id] = {
      ...image,
      imagePath,
      dataUrl: '' // Clear for version 2
    }

    // 画像ファイルをZIPに追加
    await addImageToZip(zip, imagePath, image.dataUrl)
  }

  const projectCopy: Project = {
    ...project,
    version: PROJECT_VERSION,
    images: imagesWithPaths
  }

  // project.jsonを追加（画像データは除外済み）
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
  if (!base64Data) return

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
    const images: Record<string, Image> = {}

    for (const [id, image] of Object.entries(project.images)) {
      images[id] = {
        ...image,
        dataUrl: image.imagePath
          ? await loadImageFromZip(zip, image.imagePath)
          : image.dataUrl
      }
    }

    project.images = images
  }

  // Version 1からのマイグレーションは未実装
  // 必要に応じて実装

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
