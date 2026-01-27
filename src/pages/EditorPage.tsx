import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GripHorizontal } from 'lucide-react'
import { AddSlideDialog } from '@/components/AddSlideDialog'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { SlideList } from '@/components/editor/SlideList'
import { SlidePreview } from '@/components/editor/SlidePreview'
import { PromptInputArea } from '@/components/editor/PromptInputArea'
import { ReferenceImagePanel } from '@/components/editor/ReferenceImagePanel'
import { EditHistoryDrawer } from '@/components/editor/EditHistoryDrawer'
import { useProjectStore } from '@/stores/projectStore'
import { useProcessingStore, type UploadedImage } from '@/stores/processingStore'
import { useImageOperations } from '@/hooks/useImageOperations'
import { useReferenceImages } from '@/hooks/useReferenceImages'
import { editImage, isGeminiInitialized, initializeGemini } from '@/lib/gemini'
import { extractText } from '@/lib/ocr'
import { createPdfFromImages } from '@/lib/pdf'
import { saveProjectToZip, getProjectFileName } from '@/lib/projectFile'
import {
  convertReferenceIdsToImageData,
  buildPromptWithReferences
} from '@/lib/referenceImageUtils'

export function EditorPage() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [addSlideDialogOpen, setAddSlideDialogOpen] = useState(false)
  const [addSlideInsertIndex, setAddSlideInsertIndex] = useState(0)
  const [showReferencePanel, setShowReferencePanel] = useState(false)
  const [showOcrOverlay, setShowOcrOverlay] = useState(true)

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
    appSettings,
    setSelectedSlide,
    addEditHistory,
    revertToHistory,
    reorderSlides,
    deleteSlide,
    clearSlideOcrResult,
    setSlideOcrResult
  } = useProjectStore()

  // Processing store
  const {
    processingSlides,
    slideEditStates,
    startSlideProcessing,
    updateSlideProcessingStatus,
    endSlideProcessing,
    setSlidePrompt,
    toggleSlideReference,
    removeSlideReference,
    clearSlideReferences,
    addSlideUploadedImage,
    removeSlideUploadedImage,
    clearSlideEditState
  } = useProcessingStore()

  // Get current slide's edit state
  const currentEditState = selectedSlideId ? slideEditStates[selectedSlideId] : undefined
  const prompt = currentEditState?.prompt || ''
  const selectedReferenceIds = useMemo(
    () => currentEditState?.selectedReferenceIds || new Set<string>(),
    [currentEditState?.selectedReferenceIds]
  )
  const uploadedImages = currentEditState?.uploadedImages || []

  // Get current slide's processing state
  const processingState = selectedSlideId ? processingSlides[selectedSlideId] : undefined
  const isEditExecuting = processingState?.type === 'edit'
  const isSlideProcessing = !!processingState

  // Custom hooks for image operations
  const { getCurrentImageData, getOriginalImageData } = useImageOperations(project)

  // Build reference images
  const { currentSlideReferences, pastReferenceImages, historyImages, allReferences } =
    useReferenceImages({
      project,
      selectedSlideId,
      uploadedImages,
      getCurrentImageData
    })

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
  const selectedSlideImageData = getCurrentImageData(selectedSlide)

  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])

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
        if (confirm('このスライドを削除しますか?編集履歴も削除されます。')) {
          deleteSlide(slideId)
        }
      }
    },
    [project, deleteSlide]
  )

  // Resize handlers for input area
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartY.current = e.clientY
    resizeStartHeight.current = inputAreaHeight
  }, [inputAreaHeight])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    // Dragging up (negative deltaY) increases height
    const deltaY = resizeStartY.current - e.clientY
    const newHeight = Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, resizeStartHeight.current + deltaY))
    setInputAreaHeight(newHeight)
  }, [isResizing])

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

  // Prompt change handler
  const handlePromptChange = useCallback(
    (value: string) => {
      if (selectedSlideId) {
        setSlidePrompt(selectedSlideId, value)
      }
    },
    [selectedSlideId, setSlidePrompt]
  )

  // Reference toggle handler
  const handleToggleReference = useCallback(
    (refId: string) => {
      if (selectedSlideId) {
        toggleSlideReference(selectedSlideId, refId)
      }
    },
    [selectedSlideId, toggleSlideReference]
  )

  // Reference remove handler
  const handleRemoveReference = useCallback(
    (refId: string) => {
      if (selectedSlideId) {
        removeSlideReference(selectedSlideId, refId)
      }
    },
    [selectedSlideId, removeSlideReference]
  )

  // Clear all references handler
  const handleClearAllReferences = useCallback(() => {
    if (selectedSlideId) {
      clearSlideReferences(selectedSlideId)
    }
  }, [selectedSlideId, clearSlideReferences])

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

  // Remove uploaded image handler
  const handleRemoveUploadedImage = useCallback(
    (imageId: string) => {
      if (selectedSlideId) {
        removeSlideUploadedImage(selectedSlideId, imageId)
      }
    },
    [selectedSlideId, removeSlideUploadedImage]
  )

  const handleEdit = useCallback(async () => {
    if (!selectedSlide || !prompt.trim()) return

    if (!isGeminiInitialized()) {
      alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
      navigate('/settings')
      return
    }

    // Check if already processing
    if (!startSlideProcessing(selectedSlide.id, 'edit', 'スライドの生成中...')) {
      alert('このスライドは現在処理中です。')
      return
    }

    try {
      const selectedReferences = allReferences.filter((ref) => selectedReferenceIds.has(ref.id))

      // Build full prompt with references
      const fullPrompt = buildPromptWithReferences(prompt, selectedReferences)

      const currentImageData = getCurrentImageData(selectedSlide)
      if (!currentImageData) {
        throw new Error('Current image data not found')
      }

      const resultImageDataUrl = await editImage(
        currentImageData.dataUrl,
        fullPrompt,
        project?.settings.systemPrompt
      )

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

      // Clear edit state on success
      clearSlideEditState(selectedSlide.id)
      setShowReferencePanel(false)
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
    addEditHistory,
    navigate,
    allReferences,
    selectedReferenceIds,
    getCurrentImageData,
    startSlideProcessing,
    endSlideProcessing,
    clearSlideEditState
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
      const ocrResult = await extractText(currentImageData.dataUrl, appSettings.apiKey, {
        onProgress: (status) => updateSlideProcessingStatus(selectedSlide.id, status)
      })
      setSlideOcrResult(selectedSlide.id, ocrResult)
      setShowOcrOverlay(true)
    } catch (err) {
      console.error('OCR error:', err)
      alert('OCR処理に失敗しました: ' + (err instanceof Error ? err.message : ''))
    } finally {
      endSlideProcessing(selectedSlide.id)
    }
  }, [
    selectedSlide,
    appSettings.apiKey,
    setSlideOcrResult,
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
        projectName={project.name}
        isSaving={isSaving}
        onBack={handleBack}
        onSave={handleSaveProject}
        onExportPdf={handleExportPdf}
        onOpenSettings={() => navigate('/settings')}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Slide Thumbnails */}
        <SlideList
          slides={slidesForList}
          selectedSlideId={selectedSlideId}
          onSlideSelect={setSelectedSlide}
          onAddBefore={handleAddSlideBefore}
          onAddAfter={handleAddSlideAfter}
          onDelete={handleDeleteSlide}
          onReorder={reorderSlides}
        />

        {/* Center - Main Editor */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Slide Preview with Reference Panel Overlay */}
          <div className="flex-1 min-h-0 overflow-hidden h-full relative">
            <SlidePreview
              slideId={selectedSlide.id}
              slideNumber={selectedSlide.pageNumber}
              imageData={selectedSlideImageData}
              showOcrOverlay={showOcrOverlay}
              onToggleOcrOverlay={() => setShowOcrOverlay(!showOcrOverlay)}
              onExecuteOcr={handleOcrExecute}
              onClearOcr={() => clearSlideOcrResult(selectedSlide.id)}
            />

            {/* Reference Panel - Overlay at bottom of SlidePreview */}
            {showReferencePanel && (
              <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
                <ReferenceImagePanel
                  currentSlides={currentSlideReferences}
                  uploadedImages={[...pastReferenceImages, ...uploadedImages]}
                  historyImages={historyImages}
                  selectedReferenceIds={selectedReferenceIds}
                  onToggleReference={handleToggleReference}
                  onRemoveUploadedImage={handleRemoveUploadedImage}
                  onFileUpload={handleFileUpload}
                  isEditExecuting={isEditExecuting}
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
          <div className="border-t border-gray-200 bg-white flex flex-col overflow-hidden" style={{ height: `${inputAreaHeight}px` }}>

            <PromptInputArea
              prompt={prompt}
              onPromptChange={handlePromptChange}
              onEdit={handleEdit}
              isEditExecuting={isEditExecuting}
              isSlideProcessing={isSlideProcessing}
              showReferencePanel={showReferencePanel}
              onToggleReferencePanel={() => setShowReferencePanel(!showReferencePanel)}
              selectedReferenceIds={selectedReferenceIds}
              onRemoveReference={handleRemoveReference}
              onClearAllReferences={handleClearAllReferences}
              onOpenDrawer={() => setIsDrawerOpen(true)}
              allReferences={allReferences}
            />
          </div>
        </main>
      </div>

      {/* Right Drawer */}
      <EditHistoryDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        slide={selectedSlide}
        project={project}
        onRevertToHistory={handleRevertToHistory}
        onRevertToOriginal={handleRevertToOriginal}
        getOriginalImageData={getOriginalImageData}
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
