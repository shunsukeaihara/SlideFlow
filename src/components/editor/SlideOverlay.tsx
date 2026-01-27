import { Loader2 } from 'lucide-react'

interface SlideOverlayProps {
  status: string
}

export function SlideOverlay({ status }: SlideOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 rounded-lg">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-lg font-medium">{status}</span>
        </div>
      </div>
    </div>
  )
}
