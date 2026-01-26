import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { OcrResult } from '@/types/project'

interface OcrOverlayProps {
  ocrResult: OcrResult
  imageElement: HTMLImageElement
  onClose: () => void
}

export function OcrOverlay({ ocrResult, imageElement, onClose }: OcrOverlayProps) {
  const [scale, setScale] = useState({ x: 1, y: 1 })

  useEffect(() => {
    const updateScale = () => {
      const scaleX = imageElement.offsetWidth / imageElement.naturalWidth
      const scaleY = imageElement.offsetHeight / imageElement.naturalHeight
      setScale({ x: scaleX, y: scaleY })
    }

    // Initial scale calculation
    updateScale()

    // Update scale on window resize
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [imageElement])

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: 'none'
      }}
    >
      {/* Close button */}
      <div className="absolute right-2 top-2" style={{ pointerEvents: 'auto' }}>
        <Button
          onClick={onClose}
          variant="destructive"
          size="icon"
          className="h-8 w-8 rounded-full shadow-lg"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Text blocks */}
      {ocrResult.textBlocks.map((block, index) => {
        const scaledBox = {
          left: block.bbox.x * scale.x,
          top: block.bbox.y * scale.y,
          width: block.bbox.width * scale.x,
          height: block.bbox.height * scale.y
        }

        return (
          <div
            key={index}
            className="absolute cursor-text select-text overflow-hidden border border-yellow-500/50 bg-yellow-200/20 transition-colors hover:border-yellow-500/80 hover:bg-yellow-200/30"
            style={{
              left: `${scaledBox.left}px`,
              top: `${scaledBox.top}px`,
              width: `${scaledBox.width}px`,
              height: `${scaledBox.height}px`,
              pointerEvents: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: `${scaledBox.height * 0.8}px`,
              lineHeight: `${scaledBox.height}px`,
              color: 'transparent'
            }}
            title={block.text}
          >
            {block.text}
          </div>
        )
      })}

      {/* Full text display (for easy copying) */}
      <div
        className="absolute bottom-2 left-2 right-2 max-h-32 overflow-auto rounded-lg border border-gray-300 bg-white/90 p-2 text-xs shadow-lg backdrop-blur-sm"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="mb-1 font-semibold">全文テキスト:</div>
        <div className="select-text whitespace-pre-wrap">{ocrResult.fullText}</div>
      </div>
    </div>
  )
}
