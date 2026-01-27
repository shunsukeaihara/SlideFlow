import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/stores/projectStore'
import { useGemini } from '@/context/GeminiContext'
import { extractText } from '@/lib/ocr'
import { Loader2, ScanText } from 'lucide-react'

interface OcrButtonProps {
  slideId: string
  disabled?: boolean
}

export function OcrButton({ slideId, disabled }: OcrButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const gemini = useGemini()
  const project = useProjectStore((state) => state.project)
  const setSlideOcrResult = useProjectStore((state) => state.setSlideOcrResult)

  const slide = project?.slides.find((s) => s.id === slideId)
  const currentImage = slide && project?.images[slide.image.currentImageId]

  const handleOcrClick = async () => {
    if (!slide || !currentImage) return

    setIsProcessing(true)
    setError(null)
    setStatus('Tesseract実行中...')

    try {
      const ocrResult = await extractText(currentImage.dataUrl, gemini)

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
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {status}
          </>
        ) : (
          <>
            <ScanText className="mr-2 h-4 w-4" />
            {currentImage?.ocrCache ? 'OCRを再実行' : 'OCRを実行'}
          </>
        )}
      </Button>
      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  )
}
