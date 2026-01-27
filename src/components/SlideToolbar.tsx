import { useState, useRef, useEffect, useCallback } from 'react'
import { ScanText, Eye, EyeOff, Trash2, GripVertical, Minimize2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SlideToolbarProps {
  slideId: string
  hasOcrCache: boolean
  isOcrVisible: boolean
  onExecuteOcr: () => void
  onToggleVisibility: () => void
  onClearOcr: () => void
  isProcessing: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function SlideToolbar({
  hasOcrCache,
  isOcrVisible,
  onExecuteOcr,
  onToggleVisibility,
  onClearOcr,
  isProcessing,
  containerRef
}: SlideToolbarProps) {
  // Initial position accounts for narrow screens where slide list toggle button exists
  // Button is at left-2 top-2 (8px) with size ~40x40px, so we add spacing
  const getInitialPosition = () => {
    const isNarrowScreen = typeof window !== 'undefined' && window.innerWidth < 768
    return isNarrowScreen ? { x: 56, y: 8 } : { x: 0, y: 0 }
  }
  const [position, setPosition] = useState(getInitialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking on the grip area (not buttons)
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    setIsDragging(true)
    const rect = toolbarRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
  }

  // Constrain position to container bounds
  // On narrow screens, if position overlaps with slide list toggle button, adjust it
  const constrainPosition = useCallback(() => {
    if (toolbarRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const toolbarRect = toolbarRef.current.getBoundingClientRect()

      const maxX = containerRect.width - toolbarRect.width
      const maxY = containerRect.height - toolbarRect.height

      // On narrow screens, check if position overlaps with toggle button area
      const isNarrowScreen = window.innerWidth < 768
      const minX = isNarrowScreen ? 56 : 0
      const minY = isNarrowScreen ? 8 : 0

      setPosition((prev) => {
        // Only apply minimum constraint if current position would overlap
        const needsAdjustX = isNarrowScreen && prev.x < minX
        const needsAdjustY = isNarrowScreen && prev.y < minY

        return {
          x: Math.max(needsAdjustX ? minX : 0, Math.min(prev.x, maxX)),
          y: Math.max(needsAdjustY ? minY : 0, Math.min(prev.y, maxY))
        }
      })
    }
  }, [containerRef])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && toolbarRef.current && containerRef.current) {
        // Get container bounds
        const containerRect = containerRef.current.getBoundingClientRect()
        const toolbarRect = toolbarRef.current.getBoundingClientRect()

        // Calculate new position relative to container
        let newX = e.clientX - dragOffset.x - containerRect.left
        let newY = e.clientY - dragOffset.y - containerRect.top

        // Constrain to container bounds (only max, allow moving to 0,0)
        const maxX = containerRect.width - toolbarRect.width
        const maxY = containerRect.height - toolbarRect.height

        newX = Math.max(0, Math.min(newX, maxX))
        newY = Math.max(0, Math.min(newY, maxY))

        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, containerRef])

  // Handle window resize to keep toolbar within bounds
  useEffect(() => {
    const handleResize = () => {
      constrainPosition()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [constrainPosition])

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div className="rounded-lg border border-gray-200 bg-white/95 shadow-lg backdrop-blur-sm">
        {/* Header with drag handle and minimize button */}
        <div
          className="flex items-center gap-1 border-b border-gray-200 px-2 py-1"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <GripVertical className="h-4 w-4 text-gray-500" />
          <span className="flex-1 text-xs font-medium text-gray-700">ツール</span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </button>
        </div>

        {/* Toolbar content - hidden when minimized */}
        {!isMinimized && (
          <div className="flex flex-col gap-1 py-2 px-0">
            {/* OCR Execute Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onExecuteOcr}
              disabled={isProcessing}
              className="w-full justify-start gap-1.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              <ScanText className="h-4 w-4" />
              <span className="text-xs">{hasOcrCache ? 'OCR再実行' : 'OCR実行'}</span>
            </Button>

            {/* Secondary actions - only shown when OCR cache exists */}
            {hasOcrCache && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleVisibility}
                  disabled={isProcessing}
                  className="w-full justify-start gap-1.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  {isOcrVisible ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span className="text-xs">OCRを非表示</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span className="text-xs">OCRを表示</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearOcr}
                  disabled={isProcessing}
                  className="w-full justify-start gap-1.5 text-red-600 hover:bg-gray-100 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-xs">OCR結果を削除</span>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
