import { useState, useCallback, useRef } from 'react'
import { Plus, Upload, X, Loader2, ImageIcon } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/stores/projectStore'
import { editImage, isGeminiInitialized } from '@/lib/gemini'
import { cn } from '@/lib/utils'

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
}

export function AddSlideDialog({ open, onOpenChange, insertIndex }: AddSlideDialogProps) {
  const { project, addSlide } = useProjectStore()
  const [prompt, setPrompt] = useState('')
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set())
  const [uploadedImages, setUploadedImages] = useState<ReferenceImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allReferences: ReferenceImage[] = [
    ...(project?.slides.map((slide) => ({
      id: `slide-${slide.id}`,
      dataUrl: slide.image.currentDataUrl,
      name: `スライド ${slide.pageNumber}`,
      isSlide: true,
      slideId: slide.id
    })) || []),
    ...uploadedImages
  ]

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
        const id = `upload-${Date.now()}-${Math.random()}`
        setUploadedImages((prev) => [
          ...prev,
          {
            id,
            dataUrl,
            name: file.name,
            isSlide: false
          }
        ])
        setSelectedReferenceIds((prev) => new Set([...prev, id]))
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

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      alert('プロンプトを入力してください。')
      return
    }

    if (!isGeminiInitialized()) {
      alert('APIキーが設定されていません。設定画面からAPIキーを設定してください。')
      return
    }

    const selectedReferences = allReferences.filter((ref) => selectedReferenceIds.has(ref.id))

    try {
      setIsGenerating(true)

      let resultImageDataUrl: string

      if (selectedReferences.length === 0) {
        // 参照画像なし: プロジェクト内の最初のスライドを使用（サイズ参照のため）
        const firstSlide = project?.slides[0]
        if (!firstSlide) {
          alert('プロジェクトにスライドがありません。')
          return
        }
        resultImageDataUrl = await editImage(
          firstSlide.image.currentDataUrl,
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

      // 使用した参照画像を履歴に保存（アップロード画像のみ）
      const usedReferenceImages = selectedReferences
        .filter((ref) => !ref.isSlide)
        .map((ref) => ({
          name: ref.name,
          dataUrl: ref.dataUrl
        }))

      addSlide(
        {
          imageDataUrl: resultImageDataUrl,
          width: img.width,
          height: img.height
        },
        insertIndex,
        {
          prompt,
          referenceImages: usedReferenceImages.length > 0 ? usedReferenceImages : undefined
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
  }, [prompt, selectedReferenceIds, allReferences, project, insertIndex, addSlide, onOpenChange])

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
          {/* 参照画像選択 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>参照画像（複数選択可）</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
              >
                <Upload className="mr-2 h-4 w-4" />
                画像をアップロード
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

            <ScrollArea className="h-48 border rounded-lg p-2">
              {allReferences.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <ImageIcon className="mr-2 h-5 w-5" />
                  参照画像がありません
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {allReferences.map((ref) => (
                    <div
                      key={ref.id}
                      className={cn(
                        'relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
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
                      <div className="absolute top-1 left-1">
                        <Checkbox
                          checked={selectedReferenceIds.has(ref.id)}
                          onCheckedChange={() => handleToggleReference(ref.id)}
                          className="bg-white"
                        />
                      </div>
                      {!ref.isSlide && (
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
                        <p className="text-xs text-white truncate">{ref.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-gray-500 mt-1">
              {selectedReferenceIds.size > 0
                ? `${selectedReferenceIds.size} 件の画像を選択中`
                : '画像を選択しない場合、既存のスライドスタイルを参考に生成します'}
            </p>
          </div>

          {/* プロンプト入力 */}
          <div className="flex-1">
            <Label htmlFor="prompt">プロンプト</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="生成するスライドの内容を指示してください（例：タイトルスライドを作成、グラフを追加、箇条書きでまとめる）"
              className="min-h-[120px] mt-2"
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
