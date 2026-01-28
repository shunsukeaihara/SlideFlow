import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { GripHorizontal, PanelLeftOpen } from 'lucide-react'
import { AddSlideDialog } from '@/components/AddSlideDialog'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { SlideList } from '@/components/editor/SlideList'
import { SlidePreview } from '@/components/editor/SlidePreview'
import { PromptInputArea } from '@/components/editor/PromptInputArea'
import { ReferenceImagePanel } from '@/components/editor/ReferenceImagePanel'
import { SlideInfoDrawer } from '@/components/editor/SlideInfoDrawer'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/stores/projectStore'
import { useSlideEditorStore, type UploadedImage } from '@/stores/slideEditorStore'
import { useImageOperations } from '@/hooks/useImageOperations'
import { useReferenceImages } from '@/hooks/useReferenceImages'
import { useAppRouter } from '@/hooks/useAppRouter'
import { useGemini } from '@/context/GeminiContext'
import { useShowApiKeyUI } from '@/hooks/useShowApiKeyUI'
import { extractText } from '@/lib/ocr'
import { createPdfFromImages } from '@/lib/pdf'
import { saveProjectToZip, getProjectFileName } from '@/lib/projectFile'
import { convertReferenceIdsToImageData } from '@/lib/referenceImageUtils'

export function EditorPage() {
  const router = useAppRouter()
  const gemini = useGemini()
  const showApiKeyUI = useShowApiKeyUI()
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [addSlideDialogOpen, setAddSlideDialogOpen] = useState(false)
  const [addSlideInsertIndex, setAddSlideInsertIndex] = useState(0)
  const [isSlideListOpen, setIsSlideListOpen] = useState(false)

  // Resize state for input area
  const [inputAreaHeight, setInputAreaHeight] = useState(200)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)
  const MIN_INPUT_HEIGHT = 120
  const MAX_INPUT_HEIGHT = 500

  // Project store
  const {
    project,
    selectedSlideId,
    addEditHistory,
    revertToHistory,
    clearSlideOcrResult,
    setSlideOcrResult,
    setSlideOcrVisibility,
    saveToOpfs
  } = useProjectStore()

  // Processing store
  const {
    processingSlides,
    slideEditStates,
    startSlideProcessing,
    updateSlideProcessingStatus,
    endSlideProcessing,
    addSlideUploadedImage,
    clearSlideEditState
  } = useSlideEditorStore()

  // Get current slide's edit state
  const currentEditState = selectedSlideId ? slideEditStates[selectedSlideId] : undefined
  const prompt = currentEditState?.prompt || ''
  const selectedReferenceIds = useMemo(
    () => currentEditState?.selectedReferenceIds || new Set<string>(),
    [currentEditState?.selectedReferenceIds]
  )
  const uploadedImages = currentEditState?.uploadedImages || []
  const showReferencePanel = currentEditState?.showReferencePanel || false
  const includeOcrResult = currentEditState?.includeOcrResult || false

  // Get current slide's processing state
  const processingState = selectedSlideId ? processingSlides[selectedSlideId] : undefined
  const isSlideProcessing = !!processingState

  // Custom hooks for image operations
  const { getCurrentImageData, getOriginalImageData } = useImageOperations(project)

  // Build reference images
  const { currentSlideReferences, historyImages, pastReferenceImages, allReferences } =
    useReferenceImages({
      project,
      selectedSlideId,
      uploadedImages,
      getCurrentImageData
    })

  useEffect(() => {
    if (!project) {
      router.push('/')
    }
  }, [project, router])

  // Close slide list sheet when screen becomes wide (md breakpoint = 768px)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsSlideListOpen(false)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Auto-save to OPFS when project changes (debounced)
  const projectUpdatedAt = project?.updatedAt
  useEffect(() => {
    if (!projectUpdatedAt) return

    const timeoutId = setTimeout(() => {
      saveToOpfs()
    }, 1000) // 1秒のデバウンス

    return () => clearTimeout(timeoutId)
  }, [projectUpdatedAt, saveToOpfs])

  const selectedSlide = project?.slides.find((s) => s.id === selectedSlideId)
  const selectedSlideImageData = getCurrentImageData(selectedSlide)

  const handleBack = useCallback(() => {
    router.push('/')
  }, [router])

  const handleAddSlideBefore = useCallback((slideIndex: number) => {
    setAddSlideInsertIndex(slideIndex)
    setAddSlideDialogOpen(true)
  }, [])

  const handleAddSlideAfter = useCallback((slideIndex: number) => {
    setAddSlideInsertIndex(slideIndex + 1)
    setAddSlideDialogOpen(true)
  }, [])

  // Resize handlers for input area
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      resizeStartY.current = e.clientY
      resizeStartHeight.current = inputAreaHeight
    },
    [inputAreaHeight]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      // Dragging up (negative deltaY) increases height
      const deltaY = resizeStartY.current - e.clientY
      const newHeight = Math.min(
        MAX_INPUT_HEIGHT,
        Math.max(MIN_INPUT_HEIGHT, resizeStartHeight.current + deltaY)
      )
      setInputAreaHeight(newHeight)
    },
    [isResizing]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // File upload handler
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedSlideId) return
      const files = e.target.files
      if (!files) return

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return

        const reader = new FileReader()
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string

          const img = new window.Image()
          img.onload = () => {
            const newImage: UploadedImage = {
              id: `upload-${Date.now()}-${Math.random()}`,
              name: file.name,
              dataUrl,
              width: img.width,
              height: img.height,
              isSlide: false
            }
            addSlideUploadedImage(selectedSlideId, newImage)
          }
          img.src = dataUrl
        }
        reader.readAsDataURL(file)
      })
    },
    [selectedSlideId, addSlideUploadedImage]
  )

  const handleEdit = useCallback(async () => {
    if (!selectedSlide || !prompt.trim()) return

    if (!gemini.isInitialized()) {
      // In server mode, this should not happen as Gemini is always initialized
      if (showApiKeyUI) {
        alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
        router.push('/settings')
      } else {
        alert('サーバーエラー: Gemini APIが初期化されていません。')
      }
      return
    }

    const currentImageData = getCurrentImageData(selectedSlide)
    if (!currentImageData) {
      alert('画像データが見つかりません。')
      return
    }

    // Check if OCR is needed
    const needsOcr = includeOcrResult && !currentImageData.ocrCache

    // Check if already processing
    const initialStatus = needsOcr ? 'OCR処理中...' : 'スライドの生成中...'
    if (!startSlideProcessing(selectedSlide.id, 'edit', initialStatus)) {
      alert('このスライドは現在処理中です。')
      return
    }

    try {
      let ocrResult = currentImageData.ocrCache

      // Run OCR if needed
      if (needsOcr) {
        try {
          ocrResult = await extractText(currentImageData.dataUrl, gemini, {
            onProgress: (status) => updateSlideProcessingStatus(selectedSlide.id, status)
          })
          setSlideOcrResult(selectedSlide.id, ocrResult)
        } catch (error) {
          console.error('OCR failed:', error)
          // Continue without OCR if it fails
        }
      }

      // Update status for Gemini edit
      updateSlideProcessingStatus(selectedSlide.id, 'スライドの生成中...')

      const selectedReferences = allReferences.filter((ref) => selectedReferenceIds.has(ref.id))

      // Build full prompt with OCR result if enabled
      let fullPrompt = prompt

      // Include OCR result if enabled and available
      if (includeOcrResult && ocrResult) {
        const ocrText = ocrResult.fullText
        if (ocrText) {
          fullPrompt = `${fullPrompt}\n\n【現在のスライドのテキスト内容(不完全に付き画像からも認識してください。)】\n${ocrText}`
        }
      }

      // Extract reference image data URLs
      const referenceImageDataUrls = selectedReferences.map((ref) => ref.dataUrl)

      const resultImageDataUrl = await gemini.editImage({
        sourceImageDataUrl: currentImageData.dataUrl,
        prompt: fullPrompt,
        basePrompt: project?.settings.basePrompt,
        referenceImageDataUrls,
        sourceImageSize: { width: currentImageData.width, height: currentImageData.height }
      })

      // Convert reference IDs to image data
      const { existingImageIds, newReferenceImages } = convertReferenceIdsToImageData(
        selectedReferences,
        project
      )

      addEditHistory(selectedSlide.id, {
        prompt,
        resultImageDataUrl,
        referenceImages: newReferenceImages.length > 0 ? newReferenceImages : undefined,
        existingReferenceImageIds: existingImageIds.length > 0 ? existingImageIds : undefined
      })

      // Clear edit state on success (this also resets showReferencePanel)
      clearSlideEditState(selectedSlide.id)
    } catch (error) {
      console.error('Failed to edit image:', error)
      alert('画像の編集に失敗しました。' + (error instanceof Error ? error.message : ''))
    } finally {
      endSlideProcessing(selectedSlide.id)
    }
  }, [
    selectedSlide,
    prompt,
    project,
    gemini,
    showApiKeyUI,
    addEditHistory,
    router,
    allReferences,
    selectedReferenceIds,
    includeOcrResult,
    getCurrentImageData,
    startSlideProcessing,
    updateSlideProcessingStatus,
    endSlideProcessing,
    clearSlideEditState,
    setSlideOcrResult
  ])

  const handleSaveProject = useCallback(async () => {
    if (!project || isSaving) return

    try {
      setIsSaving(true)
      const blob = await saveProjectToZip(project)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getProjectFileName(project.name)
      a.click()
      URL.revokeObjectURL(url)

      setTimeout(() => setIsSaving(false), 500)
    } catch (error) {
      console.error('Failed to save project:', error)
      alert('プロジェクトの保存に失敗しました。')
      setIsSaving(false)
    }
  }, [project, isSaving])

  const handleExportPdf = useCallback(async () => {
    if (!project || isExporting) return

    setIsExporting(true)
    try {
      const slides = project.slides.map((s) => {
        const currentImage = project.images[s.image.currentImageId]
        const originalImage = project.images[s.image.originalImageId]
        return {
          imageDataUrl: currentImage?.dataUrl || '',
          originalWidth: originalImage?.width || currentImage?.width || 0,
          originalHeight: originalImage?.height || currentImage?.height || 0
        }
      })
      const blob = await createPdfFromImages(slides)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name}_edited.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export PDF:', error)
      alert('PDFの出力に失敗しました。')
    } finally {
      setIsExporting(false)
    }
  }, [project, isExporting])

  const handleRevertToHistory = useCallback(
    (historyId: string) => {
      if (!selectedSlideId) return
      revertToHistory(selectedSlideId, historyId)
    },
    [selectedSlideId, revertToHistory]
  )

  const handleRevertToOriginal = useCallback(() => {
    if (!selectedSlide) return
    const originalImg = getOriginalImageData(selectedSlide)
    if (originalImg) {
      addEditHistory(selectedSlide.id, {
        prompt: 'オリジナルに戻す',
        resultImageDataUrl: originalImg.dataUrl
      })
    }
  }, [selectedSlide, getOriginalImageData, addEditHistory])

  const handleOcrExecute = useCallback(async () => {
    if (!selectedSlide) return

    // Check if already processing
    if (!startSlideProcessing(selectedSlide.id, 'ocr', 'OCR処理を開始中...')) {
      return
    }

    const currentImageData = getCurrentImageData(selectedSlide)
    if (!currentImageData) {
      alert('画像データが見つかりません')
      endSlideProcessing(selectedSlide.id)
      return
    }

    try {
      const ocrResult = await extractText(currentImageData.dataUrl, gemini, {
        onProgress: (status) => updateSlideProcessingStatus(selectedSlide.id, status)
      })
      setSlideOcrResult(selectedSlide.id, ocrResult)
      setSlideOcrVisibility(selectedSlide.id, true)
    } catch (err) {
      console.error('OCR error:', err)
      alert('OCR処理に失敗しました: ' + (err instanceof Error ? err.message : ''))
    } finally {
      endSlideProcessing(selectedSlide.id)
    }
  }, [
    selectedSlide,
    gemini,
    setSlideOcrResult,
    setSlideOcrVisibility,
    getCurrentImageData,
    startSlideProcessing,
    updateSlideProcessingStatus,
    endSlideProcessing
  ])

  if (!project || !selectedSlide) {
    return null
  }

  const slidesForList = project.slides.map((slide) => ({
    slide,
    imageDataUrl: project.images[slide.image.currentImageId]?.dataUrl || ''
  }))

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <EditorHeader
        isSaving={isSaving}
        isExporting={isExporting}
        onBack={handleBack}
        onSave={handleSaveProject}
        onExportPdf={handleExportPdf}
        onOpenSettings={() => router.push('/settings')}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Slide List Toggle Button - visible on narrow screens */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-2 top-2 z-10 md:hidden"
          onClick={() => setIsSlideListOpen(true)}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>

        {/* Left Sidebar - Slide Thumbnails (hidden on narrow screens) */}
        <div className="hidden md:block h-full">
          <SlideList
            slides={slidesForList}
            onAddBefore={handleAddSlideBefore}
            onAddAfter={handleAddSlideAfter}
          />
        </div>

        {/* Slide List Sheet - overlay on narrow screens */}
        <Sheet open={isSlideListOpen} onOpenChange={setIsSlideListOpen}>
          <SheetContent side="left" className="w-48 p-0 pt-6 h-full flex flex-col">
            <div className="flex-1 min-h-0 h-full">
              <SlideList
                slides={slidesForList}
                onAddBefore={handleAddSlideBefore}
                onAddAfter={handleAddSlideAfter}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Center - Main Editor */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Slide Preview with Reference Panel Overlay */}
          <div className="flex-1 min-h-0 overflow-hidden h-full relative">
            <SlidePreview
              slideId={selectedSlide.id}
              slideNumber={selectedSlide.pageNumber}
              imageData={selectedSlideImageData}
              showOcrOverlay={selectedSlide.showOcrOverlay ?? true}
              onToggleOcrOverlay={() => setSlideOcrVisibility(selectedSlide.id, !(selectedSlide.showOcrOverlay ?? true))}
              onExecuteOcr={handleOcrExecute}
              onClearOcr={() => clearSlideOcrResult(selectedSlide.id)}
            />

            {/* Reference Panel - Overlay at bottom of SlidePreview */}
            {showReferencePanel && (
              <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
                <ReferenceImagePanel
                  slideId={selectedSlide.id}
                  currentSlides={currentSlideReferences}
                  historyImages={historyImages}
                  pastReferenceImages={pastReferenceImages}
                  onFileUpload={handleFileUpload}
                />
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div
            className={`flex items-center justify-center h-3 cursor-ns-resize border-t border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors select-none ${isResizing ? 'bg-gray-200' : ''}`}
            onMouseDown={handleResizeStart}
          >
            <GripHorizontal className="h-3 w-3 text-gray-400" />
          </div>

          {/* Prompt Input */}
          <div
            className="border-t border-gray-200 bg-white flex flex-col overflow-hidden"
            style={{ height: `${inputAreaHeight}px` }}
          >
            <PromptInputArea
              slideId={selectedSlide.id}
              onEdit={handleEdit}
              isSlideProcessing={isSlideProcessing}
              onOpenDrawer={() => setIsDrawerOpen(true)}
              allReferences={allReferences}
            />
          </div>
        </main>
      </div>

      {/* Right Drawer */}
      <SlideInfoDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        slide={selectedSlide}
        project={project}
        onRevertToHistory={handleRevertToHistory}
        onRevertToOriginal={handleRevertToOriginal}
        getOriginalImageData={getOriginalImageData}
        getCurrentImageData={getCurrentImageData}
      />

      {/* Add Slide Dialog */}
      <AddSlideDialog
        open={addSlideDialogOpen}
        onOpenChange={setAddSlideDialogOpen}
        insertIndex={addSlideInsertIndex}
      />
    </div>
  )
}
