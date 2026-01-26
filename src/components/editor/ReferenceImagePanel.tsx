import { useRef, useState } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export interface ReferenceImage {
  id: string
  dataUrl: string
  name: string
  isSlide: boolean
  slideId?: string
  width?: number
  height?: number
}

interface ReferenceImagePanelProps {
  currentSlides: ReferenceImage[]
  uploadedImages: ReferenceImage[]
  historyImages: ReferenceImage[]
  selectedReferenceIds: Set<string>
  onToggleReference: (id: string) => void
  onRemoveUploadedImage: (id: string) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  isEditing: boolean
}

export function ReferenceImagePanel({
  currentSlides,
  uploadedImages,
  historyImages,
  selectedReferenceIds,
  onToggleReference,
  onRemoveUploadedImage,
  onFileUpload,
  isEditing
}: ReferenceImagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [referenceTab, setReferenceTab] = useState<'current' | 'uploaded' | 'history'>('current')

  const getDisplayImages = (): ReferenceImage[] => {
    if (referenceTab === 'current') {
      return currentSlides
    } else if (referenceTab === 'uploaded') {
      return uploadedImages
    } else {
      return historyImages
    }
  }

  const displayImages = getDisplayImages()

  return (
    <div className="border-b border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">参照画像を選択</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isEditing}
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
          onChange={onFileUpload}
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
        {displayImages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <ImageIcon className="mr-2 h-4 w-4" />
            {referenceTab === 'uploaded'
              ? '画像をアップロードしてください'
              : referenceTab === 'history'
                ? '履歴がありません'
                : '他のスライドがありません'}
          </div>
        ) : (
          <div className="flex gap-2">
            {displayImages.map((ref) => (
              <div
                key={ref.id}
                className={cn(
                  'relative flex-shrink-0 w-24 rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
                  selectedReferenceIds.has(ref.id)
                    ? 'border-blue-500'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                onClick={() => onToggleReference(ref.id)}
              >
                <img
                  src={ref.dataUrl}
                  alt={ref.name}
                  className="w-full aspect-video object-cover"
                />
                {referenceTab === 'uploaded' && ref.id.startsWith('upload-') && (
                  <button
                    className="absolute top-1 right-1 p-0.5 bg-white rounded-full hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveUploadedImage(ref.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <p className="text-[10px] text-white truncate">{ref.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
