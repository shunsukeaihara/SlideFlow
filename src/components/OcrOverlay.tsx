import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import type { OcrResult } from '@/types/project'

interface OcrOverlayProps {
  ocrResult: OcrResult
  imageElement: HTMLImageElement
}

interface ContextMenu {
  x: number
  y: number
  blockIndex: number
}

interface PopupPosition {
  x: number
  y: number
}

export function OcrOverlay({ ocrResult, imageElement }: OcrOverlayProps) {
  const [scale, setScale] = useState({ x: 1, y: 1 })
  const [imagePosition, setImagePosition] = useState({ left: 0, top: 0 })
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null)

  useEffect(() => {
    const updateScale = () => {
      const scaleX = imageElement.offsetWidth / imageElement.naturalWidth
      const scaleY = imageElement.offsetHeight / imageElement.naturalHeight
      setScale({ x: scaleX, y: scaleY })

      // Get the actual position of the image relative to its parent
      const parentRect = imageElement.parentElement?.getBoundingClientRect()
      const imageRect = imageElement.getBoundingClientRect()
      if (parentRect) {
        setImagePosition({
          left: imageRect.left - parentRect.left,
          top: imageRect.top - parentRect.top
        })
      }
    }

    // Initial scale calculation
    updateScale()

    // Update scale on window resize
    window.addEventListener('resize', updateScale)

    // Use ResizeObserver to detect image size changes
    const resizeObserver = new ResizeObserver(() => {
      updateScale()
    })
    resizeObserver.observe(imageElement)

    // Also observe the parent container for resize changes
    if (imageElement.parentElement) {
      resizeObserver.observe(imageElement.parentElement)
    }

    return () => {
      window.removeEventListener('resize', updateScale)
      resizeObserver.disconnect()
    }
  }, [imageElement])

  useEffect(() => {
    // Close context menu when clicking anywhere outside the menu
    const handleDocumentClick = (e: MouseEvent) => {
      // Don't close if clicking on a text block (let handleClick handle it)
      const target = e.target as HTMLElement
      if (target.closest('[data-ocr-block]') || target.closest('[data-context-menu]')) {
        return
      }
      setContextMenu(null)
    }
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  const handleMouseEnter = (blockIndex: number, e: React.MouseEvent) => {
    setHoveredBlock(blockIndex)
    const rect = e.currentTarget.getBoundingClientRect()
    setPopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
  }

  const handleMouseLeave = () => {
    setHoveredBlock(null)
    setPopupPosition(null)
  }

  const handleClick = (e: React.MouseEvent, blockIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      blockIndex
    })
  }

  const handleCopyText = async (blockIndex: number) => {
    const text = ocrResult.textBlocks[blockIndex].text

    // Fallback using textarea and execCommand
    const copyWithFallback = () => {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    }

    try {
      // Try modern clipboard API first (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts (HTTP)
        copyWithFallback()
      }
    } catch {
      // If clipboard API fails (e.g., permission denied), use fallback
      copyWithFallback()
    }
    setContextMenu(null)
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: 'none'
      }}
    >
      {/* Block bounding boxes */}
      {ocrResult.textBlocks.map((block, blockIndex) => {
        const scaledBox = {
          left: imagePosition.left + block.bbox.x * scale.x,
          top: imagePosition.top + block.bbox.y * scale.y,
          width: block.bbox.width * scale.x,
          height: block.bbox.height * scale.y
        }

        return (
          <div
            key={blockIndex}
            data-ocr-block
            className="absolute cursor-pointer transition-colors hover:bg-blue-500/20"
            style={{
              left: `${scaledBox.left}px`,
              top: `${scaledBox.top}px`,
              width: `${scaledBox.width}px`,
              height: `${scaledBox.height}px`,
              pointerEvents: 'auto',
              border: '2px solid rgba(59, 130, 246, 0.6)',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => handleMouseEnter(blockIndex, e)}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => handleClick(e, blockIndex)}
          />
        )
      })}

      {/* Popup tooltip */}
      {hoveredBlock !== null && popupPosition && (
        <div
          className="fixed z-50 max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-lg"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none'
          }}
        >
          <div className="select-text whitespace-pre-wrap break-words">
            {ocrResult.textBlocks[hoveredBlock].text}
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          data-context-menu
          className="fixed z-50 rounded-lg border border-gray-300 bg-white shadow-lg"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            pointerEvents: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => handleCopyText(contextMenu.blockIndex)}
          >
            <Copy className="h-4 w-4" />
            テキストをコピー
          </button>
        </div>
      )}
    </div>
  )
}
