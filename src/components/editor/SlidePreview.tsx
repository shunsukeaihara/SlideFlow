import { useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { OcrOverlay } from '@/components/OcrOverlay'
import { SlideToolbar } from '@/components/SlideToolbar'
import type { Image } from '@/types/project'

interface SlidePreviewProps {
  slideId: string
  slideNumber: number
  imageData: Image | undefined
  showOcrOverlay: boolean
  onToggleOcrOverlay: () => void
  onExecuteOcr: () => void
  onClearOcr: () => void
  isOcrProcessing: boolean
  ocrStatus: string
}

export function SlidePreview({
  slideId,
  slideNumber,
  imageData,
  showOcrOverlay,
  onToggleOcrOverlay,
  onExecuteOcr,
  onClearOcr,
  isOcrProcessing,
  ocrStatus
}: SlidePreviewProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

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
          isProcessing={isOcrProcessing}
          containerRef={imageContainerRef}
        />
      )}

      <div className="h-full w-full flex items-center justify-center">
        <ContextMenu>
          <ContextMenuTrigger asChild>
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
                    ref={imageRef}
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
                  {imageData.ocrCache && imageRef.current && showOcrOverlay && (
                    <OcrOverlay ocrResult={imageData.ocrCache} imageElement={imageRef.current} />
                  )}
                </>
              )}
              {isOcrProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-lg font-medium">{ocrStatus}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {/* Context menu content can be added here for other features if needed */}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  )
}
