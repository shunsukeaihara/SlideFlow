import { useRef, useState, useCallback } from 'react'
import { OcrOverlay } from '@/components/OcrOverlay'
import { SlideToolbar } from '@/components/SlideToolbar'
import { SlideOverlay } from '@/components/editor/SlideOverlay'
import { useProcessingStore } from '@/stores/processingStore'
import type { Image } from '@/types/project'

interface SlidePreviewProps {
  slideId: string
  slideNumber: number
  imageData: Image | undefined
  showOcrOverlay: boolean
  onToggleOcrOverlay: () => void
  onExecuteOcr: () => void
  onClearOcr: () => void
}

export function SlidePreview({
  slideId,
  slideNumber,
  imageData,
  showOcrOverlay,
  onToggleOcrOverlay,
  onExecuteOcr,
  onClearOcr
}: SlidePreviewProps) {
  // Use state instead of ref to track image element for OcrOverlay
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const handleImageRef = useCallback((element: HTMLImageElement | null) => {
    setImageElement(element)
  }, [])

  // processingStoreから処理状態を取得
  const processingState = useProcessingStore((state) => state.processingSlides[slideId])
  const isSlideProcessing = !!processingState

  return (
    <div
      ref={imageContainerRef}
      className="relative flex-1 overflow-hidden bg-gray-100 p-4"
      style={{ minHeight: 0 }}
    >
      {/* Floating Slide Toolbar */}
      {imageData && (
        <SlideToolbar
          slideId={slideId}
          hasOcrCache={!!imageData.ocrCache}
          isOcrVisible={showOcrOverlay}
          onExecuteOcr={onExecuteOcr}
          onToggleVisibility={onToggleOcrOverlay}
          onClearOcr={onClearOcr}
          isProcessing={isSlideProcessing}
          containerRef={imageContainerRef}
        />
      )}

      <div className="h-full w-full flex items-center justify-center">
        <div
          className="relative"
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {imageData && (
            <>
              <img
                ref={handleImageRef}
                src={imageData.dataUrl}
                alt={`Slide ${slideNumber}`}
                className="rounded-lg shadow-lg"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
              {imageData.ocrCache && imageElement && showOcrOverlay && (
                <OcrOverlay ocrResult={imageData.ocrCache} imageElement={imageElement} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Processing Overlay - covers entire SlidePreview */}
      {processingState && <SlideOverlay status={processingState.status} />}
    </div>
  )
}
