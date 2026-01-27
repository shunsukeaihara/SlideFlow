import { useState, useCallback, useRef } from 'react'
import { Plus, Upload, Loader2, ImageIcon, ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjectStore } from '@/stores/projectStore'
import { useImageOperations } from '@/hooks/useImageOperations'
import { useReferenceImages } from '@/hooks/useReferenceImages'
import { useReferenceSelection } from '@/hooks/useReferenceSelection'
import { generateImageFromReference, isGeminiInitialized } from '@/lib/gemini'
import { convertReferenceIdsToImageData } from '@/lib/referenceImageUtils'
import { getReferencesByIds, getReferenceById } from '@/lib/getReferenceById'
import { cn } from '@/lib/utils'
import type { ReferenceImage } from '@/types/referenceImage'

interface AddSlideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insertIndex: number
}

export function AddSlideDialog({ open, onOpenChange, insertIndex }: AddSlideDialogProps) {
  const { project, addSlide } = useProjectStore()
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showReferencePanel, setShowReferencePanel] = useState(false)
  const [referenceTab, setReferenceTab] = useState<'current' | 'uploaded' | 'history'>('current')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Image operations
  const { getCurrentImageData } = useImageOperations(project)

  // Reference selection management
  const {
    selectedReferenceIds,
    uploadedImages,
    toggleReference,
    handleFileUpload,
    resetSelection
  } = useReferenceSelection()

  // Build reference images (no need to exclude selected slide for AddSlideDialog)
  const { currentSlideReferences, pastReferenceImages, historyImages } = useReferenceImages({
    project,
    selectedSlideId: null, // No selected slide in AddSlideDialog
    uploadedImages,
    getCurrentImageData
  })

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      alert('プロンプトを入力してください。')
      return
    }

    if (!isGeminiInitialized()) {
      alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
      return
    }

    try {
      setIsGenerating(true)

      // Get selected references
      const selectedReferences = getReferencesByIds(
        selectedReferenceIds,
        project,
        uploadedImages,
        getCurrentImageData
      )

      let resultImageDataUrl: string

      if (selectedReferences.length === 0) {
        // No reference images: use first slide of project (for size reference)
        const firstSlide = project?.slides[0]
        if (!firstSlide || !project) {
          alert('プロジェクトにスライドがありません。')
          return
        }
        const firstImageData = project.images[firstSlide.image.currentImageId]
        if (!firstImageData) {
          alert('画像データが見つかりません。')
          return
        }
        resultImageDataUrl = await generateImageFromReference(
          `以下のプロンプトに基づいて新しいスライドを生成してください。元の画像は参考程度にしてください。\n\n${prompt}`,
          project?.settings.systemPrompt,
          [firstImageData.dataUrl]
        )
      } else {
        // One or more reference images
        const referenceImageDataUrls = selectedReferences.map((ref) => ref.dataUrl)

        resultImageDataUrl = await generateImageFromReference(
          prompt,
          project?.settings.systemPrompt,
          referenceImageDataUrls
        )
      }

      // Get generated image dimensions
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        img.src = resultImageDataUrl
      })

      // Convert reference IDs to image data
      const { newReferenceImages } = convertReferenceIdsToImageData(selectedReferences, project)

      addSlide(
        {
          imageDataUrl: resultImageDataUrl,
          width: img.width,
          height: img.height
        },
        insertIndex,
        {
          prompt,
          referenceImages: newReferenceImages.length > 0 ? newReferenceImages : undefined
        }
      )

      // Close dialog and reset
      onOpenChange(false)
      setPrompt('')
      resetSelection()
    } catch (error) {
      console.error('Failed to generate slide:', error)
      alert('スライドの生成に失敗しました。' + (error instanceof Error ? error.message : ''))
    } finally {
      setIsGenerating(false)
    }
  }, [
    prompt,
    selectedReferenceIds,
    uploadedImages,
    project,
    insertIndex,
    addSlide,
    onOpenChange,
    getCurrentImageData,
    resetSelection
  ])

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      onOpenChange(false)
      setPrompt('')
      resetSelection()
    }
  }, [isGenerating, onOpenChange, resetSelection])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>新しいスライドを追加</DialogTitle>
          <DialogDescription>
            参照するスライドや画像を選択し、プロンプトを入力して新しいスライドを生成します。
            スライド {insertIndex + 1} の位置に挿入されます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Reference Images Panel */}
          {showReferencePanel && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">参照画像を選択</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
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
                    アップロード画像
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
                    displayImages = currentSlideReferences
                  } else if (referenceTab === 'uploaded') {
                    displayImages = [...pastReferenceImages, ...uploadedImages]
                  } else {
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
                            : 'スライドがありません'}
                      </div>
                    )
                  }

                  return (
                    <div className="flex flex-wrap gap-2">
                      {displayImages.map((ref) => (
                        <div
                          key={ref.id}
                          className={cn(
                            'relative flex-shrink-0 w-24 rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
                            selectedReferenceIds.has(ref.id)
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                          onClick={() => toggleReference(ref.id)}
                        >
                          <img
                            src={ref.dataUrl}
                            alt={ref.name}
                            className="w-full aspect-video object-cover"
                          />
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

          {/* Prompt input */}
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

              {/* Selected References */}
              {selectedReferenceIds.size > 0 && (
                <>
                  <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                    {Array.from(selectedReferenceIds).map((id) => {
                      const ref = getReferenceById(id, project, uploadedImages, getCurrentImageData)
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
                            onClick={() => toggleReference(id)}
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
                    onClick={resetSelection}
                    className="h-7 text-xs flex-shrink-0"
                  >
                    すべて解除
                  </Button>
                </>
              )}
            </div>

            <Label htmlFor="prompt">プロンプト</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="生成するスライドの内容を指示してください（例：タイトルスライドを作成、グラフを追加、箇条書きでまとめる）"
              className="min-h-[120px] flex-1 resize-none"
              disabled={isGenerating}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            キャンセル
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                スライドを生成
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
