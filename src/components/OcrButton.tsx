import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/stores/projectStore'
import { extractText } from '@/lib/ocr'

interface OcrButtonProps {
  slideId: string
  disabled?: boolean
}

export function OcrButton({ slideId, disabled }: OcrButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const project = useProjectStore((state) => state.project)
  const apiKey = useProjectStore((state) => state.appSettings.apiKey)
  const setSlideOcrResult = useProjectStore((state) => state.setSlideOcrResult)

  const slide = project?.slides.find((s) => s.id === slideId)

  const handleOcrClick = async () => {
    if (!slide) return

    // If OCR result already exists, it will be displayed by OcrOverlay in EditorPage
    if (slide.ocrCache) {
      return
    }

    setIsProcessing(true)
    setError(null)
    setStatus('Tesseract実行中...')

    try {
      const ocrResult = await extractText(slide.image.currentDataUrl, apiKey)

      setSlideOcrResult(slideId, ocrResult)
      setStatus('')
    } catch (err) {
      console.error('OCR error:', err)
      setError(err instanceof Error ? err.message : 'OCR処理に失敗しました')
      setStatus('')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleOcrClick}
        disabled={disabled || isProcessing}
        variant="outline"
        size="sm"
      >
        {isProcessing ? status : slide?.ocrCache ? 'OCR結果を表示' : 'OCRを実行'}
      </Button>
      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  )
}
