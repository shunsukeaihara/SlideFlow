import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Save, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddSlideDialog } from '@/components/AddSlideDialog'
import { SlideList } from '@/components/editor/SlideList'
import { SlidePreview } from '@/components/editor/SlidePreview'
import { PromptInputArea } from '@/components/editor/PromptInputArea'
import { ReferenceImagePanel, type ReferenceImage } from '@/components/editor/ReferenceImagePanel'
import { EditHistoryDrawer } from '@/components/editor/EditHistoryDrawer'
import { useProjectStore } from '@/stores/projectStore'
import { editImage, isGeminiInitialized, initializeGemini } from '@/lib/gemini'
import { extractText } from '@/lib/ocr'
import { createPdfFromImages } from '@/lib/pdf'
import { saveProjectToZip, getProjectFileName } from '@/lib/projectFile'
import type { Slide } from '@/types/project'

export function EditorPage() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [addSlideDialogOpen, setAddSlideDialogOpen] = useState(false)
  const [addSlideInsertIndex, setAddSlideInsertIndex] = useState(0)
  const [showReferencePanel, setShowReferencePanel] = useState(false)
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set())
  const [uploadedImages, setUploadedImages] = useState<ReferenceImage[]>([])
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

  // Build reference images for selection
  const currentSlideReferences: ReferenceImage[] =
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

  // Past reference images (from edit history)
  const pastReferenceImages: ReferenceImage[] = (() => {
    const referenceImageIds = new Set<string>()
    project?.slides.forEach((slide) => {
      slide.editHistory.forEach((entry) => {
        entry.referenceImageIds?.forEach((id) => {
          referenceImageIds.add(id)
        })
      })
    })

    const slideImageIds = new Set<string>()
    project?.slides.forEach((slide) => {
      slideImageIds.add(slide.image.originalImageId)
      slideImageIds.add(slide.image.currentImageId)
      slide.editHistory.forEach((entry) => {
        slideImageIds.add(entry.resultImageId)
        slideImageIds.add(entry.sourceImageId)
      })
    })

    return Array.from(referenceImageIds)
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
  })()

  // History images (all result images from edit history)
  const historyImages: ReferenceImage[] = (() => {
    const images: ReferenceImage[] = []
    project?.slides.forEach((slide) => {
      slide.editHistory.forEach((entry, index) => {
        const img = project.images[entry.resultImageId]
        if (img) {
          images.push({
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
    return images
  })()

  // All references combined
  const allReferences: ReferenceImage[] = [
    ...currentSlideReferences,
    ...pastReferenceImages,
    ...uploadedImages,
    ...historyImages
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
  }, [])

  const handleRemoveUploadedImage = useCallback((id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

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

  const handleEdit = useCallback(async () => {
    if (!selectedSlide || !prompt.trim()) return

    if (!isGeminiInitialized()) {
      alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
      navigate('/settings')
      return
    }

    try {
      setIsEditing(true)

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

      const existingImageIds: string[] = []
      const newReferenceImages: Array<{
        name: string
        dataUrl: string
        width: number
        height: number
      }> = []

      selectedReferences.forEach((ref) => {
        if (ref.id.startsWith('image-')) {
          existingImageIds.push(ref.id.replace('image-', ''))
        } else if (ref.id.startsWith('history-')) {
          const entryId = ref.id.replace('history-', '')
          for (const slide of project?.slides || []) {
            const entry = slide.editHistory.find((e) => e.id === entryId)
            if (entry) {
              existingImageIds.push(entry.resultImageId)
              break
            }
          }
        } else if (ref.id.startsWith('slide-')) {
          const slideId = ref.id.replace('slide-', '')
          const slide = project?.slides.find((s) => s.id === slideId)
          if (slide) {
            existingImageIds.push(slide.image.currentImageId)
          }
        } else if (ref.id.startsWith('upload-') && ref.width && ref.height) {
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
  }, [selectedSlide, prompt, project?.settings.systemPrompt, addEditHistory, navigate, allReferences, selectedReferenceIds, getCurrentImageData])

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
              onRemoveReference={(id) => {
                const newSet = new Set(selectedReferenceIds)
                newSet.delete(id)
                setSelectedReferenceIds(newSet)
              }}
              onClearAllReferences={() => setSelectedReferenceIds(new Set())}
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
