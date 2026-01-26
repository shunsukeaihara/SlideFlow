import { useState, useCallback, useRef } from 'react'
import { Plus, Upload, X, Loader2, ImageIcon, ChevronDown, ChevronUp } from 'lucide-react'
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
import { editImage, isGeminiInitialized } from '@/lib/gemini'
import { cn } from '@/lib/utils'
import type { Slide } from '@/types/project'

interface AddSlideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insertIndex: number
}

interface ReferenceImage {
  id: string
  dataUrl: string
  name: string
  isSlide: boolean
  slideId?: string
  width?: number
  height?: number
}

export function AddSlideDialog({ open, onOpenChange, insertIndex }: AddSlideDialogProps) {
  const { project, addSlide } = useProjectStore()
  const [prompt, setPrompt] = useState('')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set())
  const [uploadedImages, setUploadedImages] = useState<ReferenceImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showReferencePanel, setShowReferencePanel] = useState(false)
  const [referenceTab, setReferenceTab] = useState<'current' | 'uploaded' | 'history'>('current')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper function to get current image data
  const getCurrentImageData = useCallback(
    (slide: Slide | undefined) => {
      if (!slide || !project?.images) return undefined
      return project.images[slide.image.currentImageId]
    },
    [project?.images]
  )

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

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      alert('プロンプトを入力してください。')
      return
    }

    if (!isGeminiInitialized()) {
      alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
      return
    }

    // Build selected references array
    const selectedReferences: ReferenceImage[] = []

    selectedReferenceIds.forEach((id) => {
      // Find in uploaded images
      const uploaded = uploadedImages.find((img) => img.id === id)
      if (uploaded) {
        selectedReferences.push(uploaded)
        return
      }

      // Find in current slides
      if (id.startsWith('slide-')) {
        const slideId = id.replace('slide-', '')
        const slide = project?.slides.find((s) => s.id === slideId)
        if (slide) {
          const imageData = getCurrentImageData(slide)
          selectedReferences.push({
            id,
            dataUrl: imageData?.dataUrl || '',
            name: `スライド ${slide.pageNumber}`,
            isSlide: true,
            slideId: slide.id,
            width: imageData?.width,
            height: imageData?.height
          })
        }
        return
      }

      // Find in uploaded reference images
      if (id.startsWith('image-')) {
        const imageId = id.replace('image-', '')
        const img = project?.images[imageId]
        if (img) {
          selectedReferences.push({
            id,
            dataUrl: img.dataUrl,
            name: `参照画像 #${img.order + 1}`,
            isSlide: false,
            width: img.width,
            height: img.height
          })
        }
        return
      }

      // Find in history
      if (id.startsWith('history-')) {
        const entryId = id.replace('history-', '')
        for (const slide of project?.slides || []) {
          const entry = slide.editHistory.find((e) => e.id === entryId)
          if (entry && project) {
            const img = project.images[entry.resultImageId]
            if (img) {
              const index = slide.editHistory.indexOf(entry)
              selectedReferences.push({
                id,
                dataUrl: img.dataUrl,
                name: `スライド ${slide.pageNumber} - 履歴 ${index + 1}`,
                isSlide: false,
                width: img.width,
                height: img.height
              })
            }
            break
          }
        }
      }
    })

    try {
      setIsGenerating(true)

      let resultImageDataUrl: string

      if (selectedReferences.length === 0) {
        // 参照画像なし: プロジェクト内の最初のスライドを使用（サイズ参照のため）
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
        resultImageDataUrl = await editImage(
          firstImageData.dataUrl,
          `以下のプロンプトに基づいて新しいスライドを生成してください。元の画像は参考程度にしてください。\n\n${prompt}`,
          project?.settings.systemPrompt
        )
      } else if (selectedReferences.length === 1) {
        // 参照画像1枚
        resultImageDataUrl = await editImage(
          selectedReferences[0].dataUrl,
          prompt,
          project?.settings.systemPrompt
        )
      } else {
        // 複数の参照画像: 最初の画像をベースに、他の画像の説明をプロンプトに含める
        const baseImage = selectedReferences[0]
        const additionalRefs = selectedReferences.slice(1)
        const refDescription = additionalRefs
          .map((ref, i) => `参照画像${i + 2}: ${ref.name}`)
          .join('\n')

        const fullPrompt = `${prompt}\n\n追加の参照画像があります:\n${refDescription}\n\n※複数の参照画像のスタイルや内容を参考にしてください。`

        resultImageDataUrl = await editImage(
          baseImage.dataUrl,
          fullPrompt,
          project?.settings.systemPrompt
        )
      }

      // 生成された画像のサイズを取得
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        img.src = resultImageDataUrl
      })

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

      // ダイアログを閉じてリセット
      onOpenChange(false)
      setPrompt('')
      setSelectedReferenceIds(new Set())
      setUploadedImages([])
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
    getCurrentImageData
  ])

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      onOpenChange(false)
      setPrompt('')
      setSelectedReferenceIds(new Set())
      setUploadedImages([])
    }
  }, [isGenerating, onOpenChange])

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
                    // Current slides
                    displayImages =
                      project?.slides.map((slide) => {
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
                    // Past reference images only
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
                    // History slides
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
                            : 'スライドがありません'}
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
                            selectedReferenceIds.has(ref.id)
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                          onClick={() => handleToggleReference(ref.id)}
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

          {/* プロンプト入力 */}
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
                            if (entry && project) {
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
