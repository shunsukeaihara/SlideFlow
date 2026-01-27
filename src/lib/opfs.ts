/**
 * OPFS (Origin Private File System) を使用したプロジェクト永続化
 * - 最大10件のプロジェクト履歴を管理
 * - プロジェクトはZIP形式で保存
 */

import { saveProjectToZip, loadProjectFromZipData } from './projectFile'
import type { Project } from '@/types/project'
import JSZip from 'jszip'

const SLIDEFLOW_DIR = 'slideflow'
const PROJECTS_DIR = 'projects'
const METADATA_FILE = 'metadata.json'
const MAX_HISTORY_COUNT = 10

export interface ProjectMetadata {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  thumbnailDataUrl?: string // 最初のスライドのサムネイル
  slideCount: number
  editCount: number // 編集履歴の総数
}

export interface ProjectHistoryEntry extends ProjectMetadata {
  fileName: string
}

interface HistoryMetadata {
  version: number
  entries: ProjectHistoryEntry[]
}

/**
 * OPFSがサポートされているかチェック
 */
export function isOpfsSupported(): boolean {
  return 'storage' in navigator && 'getDirectory' in navigator.storage
}

/**
 * SlideFlow用のOPFSディレクトリを取得
 */
async function getSlideFlowDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  const slideflowDir = await root.getDirectoryHandle(SLIDEFLOW_DIR, { create: true })
  return slideflowDir
}

/**
 * プロジェクト保存用ディレクトリを取得
 */
async function getProjectsDirectory(): Promise<FileSystemDirectoryHandle> {
  const slideflowDir = await getSlideFlowDirectory()
  const projectsDir = await slideflowDir.getDirectoryHandle(PROJECTS_DIR, { create: true })
  return projectsDir
}

/**
 * メタデータを読み込み
 */
async function loadMetadata(): Promise<HistoryMetadata> {
  try {
    const slideflowDir = await getSlideFlowDirectory()
    const metadataHandle = await slideflowDir.getFileHandle(METADATA_FILE)
    const file = await metadataHandle.getFile()
    const content = await file.text()
    return JSON.parse(content)
  } catch {
    // ファイルが存在しない場合は空のメタデータを返す
    return { version: 1, entries: [] }
  }
}

/**
 * メタデータを保存
 */
async function saveMetadata(metadata: HistoryMetadata): Promise<void> {
  const slideflowDir = await getSlideFlowDirectory()
  const metadataHandle = await slideflowDir.getFileHandle(METADATA_FILE, { create: true })
  const writable = await metadataHandle.createWritable()
  await writable.write(JSON.stringify(metadata, null, 2))
  await writable.close()
}

/**
 * プロジェクトからサムネイルを生成
 */
function generateThumbnail(project: Project): string | undefined {
  const firstSlide = project.slides[0]
  if (!firstSlide) return undefined

  const currentImage = project.images[firstSlide.image.currentImageId]
  if (!currentImage) return undefined

  // DataURLをそのまま返す（サムネイル用のリサイズは必要に応じて実装）
  return currentImage.dataUrl
}

/**
 * プロジェクトをOPFSに保存
 */
export async function saveProjectToOpfs(project: Project): Promise<void> {
  if (!isOpfsSupported()) {
    console.warn('OPFS is not supported in this browser')
    return
  }

  const projectsDir = await getProjectsDirectory()
  const fileName = `${project.id}.sfpj`

  // プロジェクトをZIPに変換
  const blob = await saveProjectToZip(project)
  const arrayBuffer = await blob.arrayBuffer()

  // OPFSに書き込み
  const fileHandle = await projectsDir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(arrayBuffer)
  await writable.close()

  // メタデータを更新
  const metadata = await loadMetadata()
  const entryIndex = metadata.entries.findIndex((e) => e.id === project.id)
  // 編集履歴の総数を計算
  const editCount = project.slides.reduce((sum, slide) => sum + slide.editHistory.length, 0)

  const newEntry: ProjectHistoryEntry = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    thumbnailDataUrl: generateThumbnail(project),
    slideCount: project.slides.length,
    editCount,
    fileName
  }

  if (entryIndex >= 0) {
    // 既存エントリを更新（先頭に移動）
    metadata.entries.splice(entryIndex, 1)
    metadata.entries.unshift(newEntry)
  } else {
    // 新規エントリを先頭に追加
    metadata.entries.unshift(newEntry)
  }

  // 最大件数を超えた古いエントリを削除
  while (metadata.entries.length > MAX_HISTORY_COUNT) {
    const oldEntry = metadata.entries.pop()
    if (oldEntry) {
      try {
        await projectsDir.removeEntry(oldEntry.fileName)
      } catch {
        // ファイルが存在しない場合は無視
      }
    }
  }

  await saveMetadata(metadata)
}

/**
 * OPFSからプロジェクトを読み込み
 */
export async function loadProjectFromOpfs(projectId: string): Promise<Project | null> {
  if (!isOpfsSupported()) {
    console.warn('OPFS is not supported in this browser')
    return null
  }

  const metadata = await loadMetadata()
  const entryIndex = metadata.entries.findIndex((e) => e.id === projectId)
  if (entryIndex < 0) return null

  const entry = metadata.entries[entryIndex]
  const projectsDir = await getProjectsDirectory()

  try {
    const fileHandle = await projectsDir.getFileHandle(entry.fileName)
    const file = await fileHandle.getFile()
    const arrayBuffer = await file.arrayBuffer()

    const zip = await JSZip.loadAsync(arrayBuffer)
    const project = await loadProjectFromZipData(zip)

    // 履歴を先頭に移動
    if (entryIndex > 0) {
      metadata.entries.splice(entryIndex, 1)
      metadata.entries.unshift(entry)
      await saveMetadata(metadata)
    }

    return project
  } catch {
    console.error(`Failed to load project ${projectId} from OPFS`)
    return null
  }
}

/**
 * プロジェクト履歴を取得
 */
export async function getProjectHistory(): Promise<ProjectHistoryEntry[]> {
  if (!isOpfsSupported()) {
    return []
  }

  const metadata = await loadMetadata()
  return metadata.entries
}

/**
 * プロジェクトをOPFSから削除
 */
export async function deleteProjectFromOpfs(projectId: string): Promise<void> {
  if (!isOpfsSupported()) return

  const metadata = await loadMetadata()
  const entryIndex = metadata.entries.findIndex((e) => e.id === projectId)
  if (entryIndex < 0) return

  const entry = metadata.entries[entryIndex]
  const projectsDir = await getProjectsDirectory()

  try {
    await projectsDir.removeEntry(entry.fileName)
  } catch {
    // ファイルが存在しない場合は無視
  }

  metadata.entries.splice(entryIndex, 1)
  await saveMetadata(metadata)
}

/**
 * 全てのOPFSデータをクリア
 */
export async function clearAllOpfsData(): Promise<void> {
  if (!isOpfsSupported()) return

  const root = await navigator.storage.getDirectory()
  try {
    await root.removeEntry(SLIDEFLOW_DIR, { recursive: true })
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}
