import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Download,
  Save,
  Settings,
  History,
  Wand2,
  Loader2,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Upload,
  X,
  ImageIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { AddSlideDialog } from '@/components/AddSlideDialog'
import { OcrOverlay } from '@/components/OcrOverlay'
import { SlideToolbar } from '@/components/SlideToolbar'
import { useProjectStore } from '@/stores/projectStore'
import { editImage, isGeminiInitialized, initializeGemini } from '@/lib/gemini'
import { extractText } from '@/lib/ocr'
import { createPdfFromImages } from '@/lib/pdf'
import { saveProjectToZip, getProjectFileName } from '@/lib/projectFile'
import { cn } from '@/lib/utils'
import type { Slide } from '@/types/project'

interface ReferenceImage {
  id: string
  dataUrl: string
  name: string
  isSlide: boolean
  slideId?: string
  width?: number
  height?: number
}

interface SortableSlideItemProps {
  slide: Slide
  imageDataUrl: string
  isSelected: boolean
  onSelect: () => void
  onAddBefore: () => void
  onAddAfter: () => void
  onDelete: () => void
  canDelete: boolean
}

function SortableSlideItem({
  slide,
  imageDataUrl,
  isSelected,
  onSelect,
  onAddBefore,
  onAddAfter,
  onDelete,
  canDelete
}: SortableSlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
    opacity: isDragging ? 0.8 : 1
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'relative w-full overflow-hidden rounded-lg border-2 transition-all group',
            isSelected ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-300',
            isDragging && 'shadow-xl'
          )}
        >
          <button onClick={onSelect} className="w-full">
            <img src={imageDataUrl} alt={`Slide ${slide.pageNumber}`} className="w-full" />
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {slide.pageNumber}
            </div>
            {slide.editHistory.length > 0 && (
              <div className="absolute right-1 top-1 rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                {slide.editHistory.length}
              </div>
            )}
          </button>
          {/* ドラッグハンドル */}
          <div
            {...attributes}
            {...listeners}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-white" />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onAddBefore}>
          <Plus className="mr-2 h-4 w-4" />
          前にスライドを追加
        </ContextMenuItem>
        <ContextMenuItem onClick={onAddAfter}>
          <Plus className="mr-2 h-4 w-4" />
          後にスライドを追加
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDelete}
          disabled={!canDelete}
          className={cn(!canDelete && 'opacity-50 cursor-not-allowed')}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          スライドを削除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function EditorPage() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('history')
  const [addSlideDialogOpen, setAddSlideDialogOpen] = useState(false)
  const [addSlideInsertIndex, setAddSlideInsertIndex] = useState(0)
  const [showReferencePanel, setShowReferencePanel] = useState(false)
  const [referenceTab, setReferenceTab] = useState<'current' | 'uploaded' | 'history'>('current')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set())
  const [uploadedImages, setUploadedImages] = useState<ReferenceImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [showOcrOverlay, setShowOcrOverlay] = useState(true)
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [ocrStatus, setOcrStatus] = useState('')

  const {
    project,
    selectedSlideId,
    appSettings,
    setSelectedSlide,
    addEditHistory,
    revertToHistory,
    reorderSlides,
    deleteSlide,
    clearSlideOcrResult,
    setSlideOcrResult
  } = useProjectStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  useEffect(() => {
    if (!project) {
      navigate('/')
    }
  }, [project, navigate])

  useEffect(() => {
    if (appSettings.apiKey && !isGeminiInitialized()) {
      initializeGemini(appSettings.apiKey)
    }
  }, [appSettings.apiKey])

  const selectedSlide = project?.slides.find((s) => s.id === selectedSlideId)

  // Helper functions to get image data from the image pool
  const getCurrentImageData = useCallback(
    (slide: Slide | undefined) => {
      if (!slide || !project?.images) return undefined
      return project.images[slide.image.currentImageId]
    },
    [project?.images]
  )

  const getOriginalImageData = useCallback(
    (slide: Slide | undefined) => {
      if (!slide || !project?.images) return undefined
      return project.images[slide.image.originalImageId]
    },
    [project?.images]
  )

  const selectedSlideImageData = getCurrentImageData(selectedSlide)

  // 参照画像リストを構築（選択中のスライドを除く）
  const allReferences: ReferenceImage[] = [
    ...(project?.slides
      .filter((slide) => slide.id !== selectedSlideId)
      .map((slide) => {
        const imageData = getCurrentImageData(slide)
        return {
          id: `slide-${slide.id}`,
          dataUrl: imageData?.dataUrl || '',
          name: `スライド ${slide.pageNumber}`,
          isSlide: true,
          slideId: slide.id,
          width: imageData?.width,
          height: imageData?.height
        }
      }) || []),
    ...uploadedImages
  ]

  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleToggleReference = useCallback((id: string) => {
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string

        // Get image dimensions
        const img = new window.Image()
        img.onload = () => {
          const id = `upload-${Date.now()}-${Math.random()}`
          setUploadedImages((prev) => [
            ...prev,
            {
              id,
              dataUrl,
              name: file.name,
              isSlide: false,
              width: img.width,
              height: img.height
            }
          ])
          setSelectedReferenceIds((prev) => new Set([...prev, id]))
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleRemoveUploadedImage = useCallback((id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        reorderSlides(active.id as string, over.id as string)
      }
    },
    [reorderSlides]
  )

  const handleAddSlideBefore = useCallback((slideIndex: number) => {
    setAddSlideInsertIndex(slideIndex)
    setAddSlideDialogOpen(true)
  }, [])

  const handleAddSlideAfter = useCallback((slideIndex: number) => {
    setAddSlideInsertIndex(slideIndex + 1)
    setAddSlideDialogOpen(true)
  }, [])

  const handleDeleteSlide = useCallback(
    (slideId: string) => {
      if (project && project.slides.length > 1) {
        if (confirm('このスライドを削除しますか？編集履歴も削除されます。')) {
          deleteSlide(slideId)
        }
      }
    },
    [project, deleteSlide]
  )

  const handleEdit = useCallback(async () => {
    if (!selectedSlide || !prompt.trim()) return

    if (!isGeminiInitialized()) {
      alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
      navigate('/settings')
      return
    }

    try {
      setIsEditing(true)

      // 選択された参照画像を取得
      const selectedReferences = allReferences.filter((ref) => selectedReferenceIds.has(ref.id))

      let fullPrompt = prompt
      if (selectedReferences.length > 0) {
        const refDescription = selectedReferences
          .map((ref, i) => `参照画像${i + 1}: ${ref.name}`)
          .join('\n')
        fullPrompt = `${prompt}\n\n【参照画像】\n${refDescription}\n\n上記の参照画像のスタイルや内容を参考にして編集してください。`
      }

      const currentImageData = getCurrentImageData(selectedSlide)
      if (!currentImageData) {
        throw new Error('Current image data not found')
      }

      const resultImageDataUrl = await editImage(
        currentImageData.dataUrl,
        fullPrompt,
        project?.settings.systemPrompt
      )

      // 使用した参照画像を履歴に保存
      // - 既存画像（image-*, history-*, slide-*）はIDのみを記録
      // - 新規アップロード画像（upload-*）は新規としてimages辞書に追加

      const existingImageIds: string[] = []
      const newReferenceImages: Array<{
        name: string
        dataUrl: string
        width: number
        height: number
      }> = []

      selectedReferences.forEach((ref) => {
        if (ref.id.startsWith('image-')) {
          // Already in project.images, just reference by ID
          existingImageIds.push(ref.id.replace('image-', ''))
        } else if (ref.id.startsWith('history-')) {
          // History image - find the result image ID
          const entryId = ref.id.replace('history-', '')
          for (const slide of project?.slides || []) {
            const entry = slide.editHistory.find((e) => e.id === entryId)
            if (entry) {
              existingImageIds.push(entry.resultImageId)
              break
            }
          }
        } else if (ref.id.startsWith('slide-')) {
          // Current slide image
          const slideId = ref.id.replace('slide-', '')
          const slide = project?.slides.find((s) => s.id === slideId)
          if (slide) {
            existingImageIds.push(slide.image.currentImageId)
          }
        } else if (ref.id.startsWith('upload-') && ref.width && ref.height) {
          // New uploaded image - add to images dictionary
          newReferenceImages.push({
            name: ref.name,
            dataUrl: ref.dataUrl,
            width: ref.width,
            height: ref.height
          })
        }
      })

      addEditHistory(selectedSlide.id, {
        prompt,
        resultImageDataUrl,
        referenceImages: newReferenceImages.length > 0 ? newReferenceImages : undefined,
        existingReferenceImageIds: existingImageIds.length > 0 ? existingImageIds : undefined
      })

      setPrompt('')
      setSelectedReferenceIds(new Set())
      setUploadedImages([])
      setShowReferencePanel(false)
    } catch (error) {
      console.error('Failed to edit image:', error)
      alert('画像の編集に失敗しました。' + (error instanceof Error ? error.message : ''))
    } finally {
      setIsEditing(false)
    }
  }, [
    selectedSlide,
    prompt,
    project?.settings.systemPrompt,
    addEditHistory,
    navigate,
    allReferences,
    selectedReferenceIds
  ])

  // プロジェクトファイルをダウンロード保存
  const handleSaveProject = useCallback(async () => {
    if (!project || isSaving) return

    try {
      setIsSaving(true)
      // プロジェクトをZIPファイルに変換
      const blob = await saveProjectToZip(project)

      // ブラウザのダウンロード機能を使用してファイルを保存
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getProjectFileName(project.name) // {プロジェクト名}.sfpj
      a.click()
      URL.revokeObjectURL(url)

      // ダウンロード完了後、少し待ってからインジケーターを非表示
      setTimeout(() => setIsSaving(false), 500)
    } catch (error) {
      console.error('Failed to save project:', error)
      alert('プロジェクトの保存に失敗しました。')
      setIsSaving(false)
    }
  }, [project, isSaving])

  const handleExportPdf = useCallback(async () => {
    if (!project) return

    try {
      const images = project.slides.map((s) => {
        const imageData = project.images[s.image.currentImageId]
        return imageData?.dataUrl || ''
      })
      const blob = await createPdfFromImages(images)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name}_edited.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export PDF:', error)
      alert('PDFの出力に失敗しました。')
    }
  }, [project])

  const handleRevertToHistory = useCallback(
    (historyId: string) => {
      if (!selectedSlideId) return
      revertToHistory(selectedSlideId, historyId)
    },
    [selectedSlideId, revertToHistory]
  )

  const handleOcrExecute = useCallback(async () => {
    if (!selectedSlide || isOcrProcessing) return

    const currentImageData = getCurrentImageData(selectedSlide)
    if (!currentImageData) {
      alert('画像データが見つかりません')
      return
    }

    setIsOcrProcessing(true)
    setOcrStatus('OCR処理を開始中...')

    try {
      const ocrResult = await extractText(currentImageData.dataUrl, appSettings.apiKey, {
        onProgress: (status) => setOcrStatus(status)
      })
      setSlideOcrResult(selectedSlide.id, ocrResult)
      setShowOcrOverlay(true)
    } catch (err) {
      console.error('OCR error:', err)
      alert('OCR処理に失敗しました: ' + (err instanceof Error ? err.message : ''))
    } finally {
      setIsOcrProcessing(false)
      setOcrStatus('')
    }
  }, [selectedSlide, isOcrProcessing, appSettings.apiKey, setSlideOcrResult])

  if (!project || !selectedSlide) {
    return null
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveProject} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF出力
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Slide Thumbnails */}
        <aside className="w-48 border-r border-gray-200 bg-gray-50">
          <ScrollArea className="h-full">
            <div className="space-y-2 p-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={project.slides.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {project.slides.map((slide, index) => {
                    const imageData = project.images[slide.image.currentImageId]
                    return (
                      <SortableSlideItem
                        key={slide.id}
                        slide={slide}
                        imageDataUrl={imageData?.dataUrl || ''}
                        isSelected={slide.id === selectedSlideId}
                        onSelect={() => setSelectedSlide(slide.id)}
                        onAddBefore={() => handleAddSlideBefore(index)}
                        onAddAfter={() => handleAddSlideAfter(index)}
                        onDelete={() => handleDeleteSlide(slide.id)}
                        canDelete={project.slides.length > 1}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>
        </aside>

        {/* Center - Main Editor */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Slide Preview */}
          <div
            ref={imageContainerRef}
            className="relative flex-1 overflow-hidden bg-gray-100 p-4"
            style={{ minHeight: 0 }}
          >
            {/* Floating Slide Toolbar */}
            {selectedSlide && selectedSlideImageData && (
              <SlideToolbar
                slideId={selectedSlide.id}
                hasOcrCache={!!selectedSlideImageData.ocrCache}
                isOcrVisible={showOcrOverlay}
                onExecuteOcr={handleOcrExecute}
                onToggleVisibility={() => setShowOcrOverlay(!showOcrOverlay)}
                onClearOcr={() => clearSlideOcrResult(selectedSlide.id)}
                isProcessing={isOcrProcessing}
                containerRef={imageContainerRef}
              />
            )}

            <div className="h-full w-full flex items-center justify-center">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    className="relative"
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {selectedSlideImageData && (
                      <>
                        <img
                          ref={imageRef}
                          src={selectedSlideImageData.dataUrl}
                          alt={`Slide ${selectedSlide.pageNumber}`}
                          className="rounded-lg shadow-lg"
                          style={{
                            display: 'block',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain'
                          }}
                        />
                        {selectedSlideImageData.ocrCache && imageRef.current && showOcrOverlay && (
                          <OcrOverlay
                            ocrResult={selectedSlideImageData.ocrCache}
                            imageElement={imageRef.current}
                          />
                        )}
                      </>
                    )}
                    {isOcrProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <span className="text-lg font-medium">{ocrStatus}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {/* Context menu content can be added here for other features if needed */}
                </ContextMenuContent>
              </ContextMenu>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="border-t border-gray-200 bg-white">
            {/* Reference Images Panel */}
            {showReferencePanel && (
              <div className="border-b border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">参照画像を選択</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isEditing}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    画像を追加
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* Tabs */}
                <Tabs
                  value={referenceTab}
                  onValueChange={(v) => setReferenceTab(v as 'current' | 'uploaded' | 'history')}
                  className="mb-2"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="current" className="text-xs">
                      現在のスライド
                    </TabsTrigger>
                    <TabsTrigger value="uploaded" className="text-xs">
                      過去アップロードした画像
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs">
                      履歴のスライド
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <ScrollArea className="h-28">
                  {(() => {
                    let displayImages: ReferenceImage[] = []

                    if (referenceTab === 'current') {
                      // Current slides only (excluding selected slide)
                      displayImages =
                        project?.slides
                          .filter((slide) => slide.id !== selectedSlideId)
                          .map((slide) => {
                            const imageData = getCurrentImageData(slide)
                            return {
                              id: `slide-${slide.id}`,
                              dataUrl: imageData?.dataUrl || '',
                              name: `スライド ${slide.pageNumber}`,
                              isSlide: true,
                              slideId: slide.id,
                              width: imageData?.width,
                              height: imageData?.height
                            }
                          }) || []
                    } else if (referenceTab === 'uploaded') {
                      // Uploaded images - only past reference images (not current session uploads)
                      // Get all reference image IDs used in history across all slides
                      const referenceImageIds = new Set<string>()
                      project?.slides.forEach((slide) => {
                        slide.editHistory.forEach((entry) => {
                          entry.referenceImageIds?.forEach((id) => {
                            referenceImageIds.add(id)
                          })
                        })
                      })

                      // Get slide image IDs to exclude them (they're not "uploaded")
                      const slideImageIds = new Set<string>()
                      project?.slides.forEach((slide) => {
                        slideImageIds.add(slide.image.originalImageId)
                        slideImageIds.add(slide.image.currentImageId)
                        slide.editHistory.forEach((entry) => {
                          slideImageIds.add(entry.resultImageId)
                          slideImageIds.add(entry.sourceImageId)
                        })
                      })

                      // Past reference images only
                      const pastReferenceImages: ReferenceImage[] = Array.from(referenceImageIds)
                        .filter((id) => !slideImageIds.has(id))
                        .map((id) => {
                          const img = project?.images[id]
                          if (!img) return null
                          return {
                            id: `image-${img.id}`,
                            dataUrl: img.dataUrl,
                            name: `参照画像 #${img.order + 1}`,
                            isSlide: false,
                            width: img.width,
                            height: img.height
                          } as ReferenceImage
                        })
                        .filter((img): img is ReferenceImage => img !== null)

                      displayImages = pastReferenceImages
                    } else {
                      // History slides - all result images from edit history
                      const historyImages: ReferenceImage[] = []
                      project?.slides.forEach((slide) => {
                        slide.editHistory.forEach((entry, index) => {
                          const img = project.images[entry.resultImageId]
                          if (img) {
                            historyImages.push({
                              id: `history-${entry.id}`,
                              dataUrl: img.dataUrl,
                              name: `スライド ${slide.pageNumber} - 履歴 ${index + 1}`,
                              isSlide: false,
                              width: img.width,
                              height: img.height
                            })
                          }
                        })
                      })
                      displayImages = historyImages
                    }

                    if (displayImages.length === 0) {
                      return (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                          <ImageIcon className="mr-2 h-4 w-4" />
                          {referenceTab === 'uploaded'
                            ? '画像をアップロードしてください'
                            : referenceTab === 'history'
                              ? '履歴がありません'
                              : '他のスライドがありません'}
                        </div>
                      )
                    }

                    return (
                      <div className="flex gap-2">
                        {displayImages.map((ref) => (
                          <div
                            key={ref.id}
                            className={cn(
                              'relative flex-shrink-0 w-24 rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
                              'border-gray-200 hover:border-gray-300'
                            )}
                            onClick={() => handleToggleReference(ref.id)}
                          >
                            <img
                              src={ref.dataUrl}
                              alt={ref.name}
                              className="w-full aspect-video object-cover"
                            />
                            {referenceTab === 'uploaded' && ref.id.startsWith('upload-') && (
                              <button
                                className="absolute top-1 right-1 p-0.5 bg-white rounded-full hover:bg-gray-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveUploadedImage(ref.id)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                              <p className="text-[10px] text-white truncate">{ref.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </ScrollArea>
              </div>
            )}

            <div className="p-4">
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowReferencePanel(!showReferencePanel)}
                      className="gap-1 text-gray-600"
                    >
                      {showReferencePanel ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                      参照画像
                    </Button>

                    {/* Selected References - shown next to the button */}
                    {selectedReferenceIds.size > 0 && (
                      <>
                        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                          {Array.from(selectedReferenceIds).map((id) => {
                            const ref = (() => {
                              // Find in uploaded images
                              const uploaded = uploadedImages.find((img) => img.id === id)
                              if (uploaded) return uploaded

                              // Find in current slides
                              if (id.startsWith('slide-')) {
                                const slideId = id.replace('slide-', '')
                                const slide = project?.slides.find((s) => s.id === slideId)
                                if (slide) {
                                  const imageData = getCurrentImageData(slide)
                                  return {
                                    id,
                                    dataUrl: imageData?.dataUrl || '',
                                    name: `スライド ${slide.pageNumber}`,
                                    isSlide: true,
                                    slideId: slide.id,
                                    width: imageData?.width,
                                    height: imageData?.height
                                  }
                                }
                              }

                              // Find in uploaded reference images
                              if (id.startsWith('image-')) {
                                const imageId = id.replace('image-', '')
                                const img = project?.images[imageId]
                                if (img) {
                                  return {
                                    id,
                                    dataUrl: img.dataUrl,
                                    name: `参照画像 #${img.order + 1}`,
                                    isSlide: false,
                                    width: img.width,
                                    height: img.height
                                  }
                                }
                              }

                              // Find in history
                              if (id.startsWith('history-')) {
                                const entryId = id.replace('history-', '')
                                for (const slide of project?.slides || []) {
                                  const entry = slide.editHistory.find((e) => e.id === entryId)
                                  if (entry) {
                                    const img = project.images[entry.resultImageId]
                                    if (img) {
                                      const index = slide.editHistory.indexOf(entry)
                                      return {
                                        id,
                                        dataUrl: img.dataUrl,
                                        name: `スライド ${slide.pageNumber} - 履歴 ${index + 1}`,
                                        isSlide: false,
                                        width: img.width,
                                        height: img.height
                                      }
                                    }
                                  }
                                }
                              }

                              return null
                            })()

                            if (!ref) return null

                            return (
                              <div
                                key={id}
                                className="relative flex-shrink-0 w-12 h-8 rounded border-2 border-blue-500 overflow-hidden"
                              >
                                <img
                                  src={ref.dataUrl}
                                  alt={ref.name}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl hover:bg-red-600"
                                  onClick={() => {
                                    const newSet = new Set(selectedReferenceIds)
                                    newSet.delete(id)
                                    setSelectedReferenceIds(newSet)
                                  }}
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReferenceIds(new Set())}
                          className="h-7 text-xs flex-shrink-0"
                        >
                          すべて解除
                        </Button>
                      </>
                    )}
                  </div>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="編集の指示を入力してください（例：背景を青空に変更、テキストのフォントを大きく）"
                    className="min-h-[80px] flex-1 resize-none"
                    disabled={isEditing}
                  />
                </div>
                <div className="flex flex-col gap-2 justify-end">
                  <Button
                    onClick={handleEdit}
                    disabled={isEditing || !prompt.trim()}
                    className="min-w-[100px]"
                  >
                    {isEditing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        編集中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        編集
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDrawerOpen(true)}
                    className="gap-1"
                  >
                    <History className="h-4 w-4" />
                    履歴
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Right Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>スライド情報</SheetTitle>
            <SheetDescription>スライド {selectedSlide.pageNumber} の詳細</SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="history" className="flex-1">
                編集履歴
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                設定
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                {selectedSlide.editHistory.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">まだ編集履歴がありません</div>
                ) : (
                  <div className="space-y-4">
                    {[...selectedSlide.editHistory].reverse().map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString('ja-JP')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevertToHistory(entry.id)}
                            className="h-6 text-xs"
                          >
                            この状態に戻す
                          </Button>
                        </div>
                        <p className="mb-2 text-sm text-gray-700">{entry.prompt}</p>
                        {entry.referenceImageIds && entry.referenceImageIds.length > 0 && (
                          <div className="mb-2">
                            <p className="mb-1 text-xs text-gray-500">参照画像</p>
                            <div className="flex gap-1 flex-wrap">
                              {entry.referenceImageIds.map((refId) => {
                                const refImage = project.images[refId]
                                if (!refImage) return null
                                return (
                                  <div
                                    key={refId}
                                    className="relative w-12 h-8 rounded border border-gray-200 overflow-hidden"
                                  >
                                    <img
                                      src={refImage.dataUrl}
                                      alt="参照画像"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="mb-1 text-xs text-gray-500">Before</p>
                            {project.images[entry.sourceImageId] && (
                              <img
                                src={project.images[entry.sourceImageId].dataUrl}
                                alt="Before"
                                className="w-full rounded border border-gray-200"
                              />
                            )}
                          </div>
                          <div>
                            <p className="mb-1 text-xs text-gray-500">After</p>
                            {project.images[entry.resultImageId] && (
                              <img
                                src={project.images[entry.resultImageId].dataUrl}
                                alt="After"
                                className="w-full rounded border border-gray-200"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium">オリジナル画像</h4>
                  {getOriginalImageData(selectedSlide) && (
                    <>
                      <img
                        src={getOriginalImageData(selectedSlide)!.dataUrl}
                        alt="Original"
                        className="w-full rounded-lg border border-gray-200"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => {
                          const originalImg = getOriginalImageData(selectedSlide)
                          if (originalImg) {
                            addEditHistory(selectedSlide.id, {
                              prompt: 'オリジナルに戻す',
                              resultImageDataUrl: originalImg.dataUrl
                            })
                          }
                        }}
                      >
                        オリジナルに戻す
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Add Slide Dialog */}
      <AddSlideDialog
        open={addSlideDialogOpen}
        onOpenChange={setAddSlideDialogOpen}
        insertIndex={addSlideInsertIndex}
      />
    </div>
  )
}
