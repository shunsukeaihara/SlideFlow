import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Save, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddSlideDialog } from '@/components/AddSlideDialog'
import { SlideList } from '@/components/editor/SlideList'
import { SlidePreview } from '@/components/editor/SlidePreview'
import { PromptInputArea } from '@/components/editor/PromptInputArea'
import { ReferenceImagePanel } from '@/components/editor/ReferenceImagePanel'
import { EditHistoryDrawer } from '@/components/editor/EditHistoryDrawer'
import { useProjectStore } from '@/stores/projectStore'
import { useImageOperations } from '@/hooks/useImageOperations'
import { useReferenceImages } from '@/hooks/useReferenceImages'
import { useReferenceSelection } from '@/hooks/useReferenceSelection'
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
  const [prompt, setPrompt] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [addSlideDialogOpen, setAddSlideDialogOpen] = useState(false)
  const [addSlideInsertIndex, setAddSlideInsertIndex] = useState(0)
  const [showReferencePanel, setShowReferencePanel] = useState(false)
  const [showOcrOverlay, setShowOcrOverlay] = useState(true)
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [ocrStatus, setOcrStatus] = useState('')

  // Reference selection management
  const {
    selectedReferenceIds,
    uploadedImages,
    toggleReference: handleToggleReference,
    removeReference,
    clearAllReferences,
    handleFileUpload,
    removeUploadedImage: handleRemoveUploadedImage,
    resetSelection
  } = useReferenceSelection()

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

  const handleEdit = useCallback(
    async () => {
      if (!selectedSlide || !prompt.trim()) return

      if (!isGeminiInitialized()) {
        alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
        navigate('/settings')
        return
      }

      try {
        setIsEditing(true)

        const selectedReferences = allReferences.filter((ref) =>
          selectedReferenceIds.has(ref.id)
        )

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

        setPrompt('')
        resetSelection()
        setShowReferencePanel(false)
      } catch (error) {
        console.error('Failed to edit image:', error)
        alert('画像の編集に失敗しました。' + (error instanceof Error ? error.message : ''))
      } finally {
        setIsEditing(false)
      }
    },
    [
      selectedSlide,
      prompt,
      project,
      addEditHistory,
      navigate,
      allReferences,
      selectedReferenceIds,
      getCurrentImageData,
      resetSelection
    ]
  )

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
  }, [selectedSlide, isOcrProcessing, appSettings.apiKey, setSlideOcrResult, getCurrentImageData])

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
          {/* Slide Preview */}
          <SlidePreview
            slideId={selectedSlide.id}
            slideNumber={selectedSlide.pageNumber}
            imageData={selectedSlideImageData}
            showOcrOverlay={showOcrOverlay}
            onToggleOcrOverlay={() => setShowOcrOverlay(!showOcrOverlay)}
            onExecuteOcr={handleOcrExecute}
            onClearOcr={() => clearSlideOcrResult(selectedSlide.id)}
            isOcrProcessing={isOcrProcessing}
            ocrStatus={ocrStatus}
          />

          {/* Prompt Input */}
          <div className="border-t border-gray-200 bg-white">
            {showReferencePanel && (
              <ReferenceImagePanel
                currentSlides={currentSlideReferences}
                uploadedImages={[...pastReferenceImages, ...uploadedImages]}
                historyImages={historyImages}
                selectedReferenceIds={selectedReferenceIds}
                onToggleReference={handleToggleReference}
                onRemoveUploadedImage={handleRemoveUploadedImage}
                onFileUpload={handleFileUpload}
                isEditing={isEditing}
              />
            )}

            <PromptInputArea
              prompt={prompt}
              onPromptChange={setPrompt}
              onEdit={handleEdit}
              isEditing={isEditing}
              showReferencePanel={showReferencePanel}
              onToggleReferencePanel={() => setShowReferencePanel(!showReferencePanel)}
              selectedReferenceIds={selectedReferenceIds}
              onRemoveReference={removeReference}
              onClearAllReferences={clearAllReferences}
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
