import { X, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ReferenceImage } from '@/types/referenceImage'

interface SelectedReferencesPopoverProps {
  selectedReferenceIds: Set<string>
  allReferences: ReferenceImage[]
  onRemoveReference: (id: string) => void
  onClearAllReferences: () => void
  disabled?: boolean
}

export function SelectedReferencesPopover({
  selectedReferenceIds,
  allReferences,
  onRemoveReference,
  onClearAllReferences,
  disabled = false
}: SelectedReferencesPopoverProps) {
  const selectedCount = selectedReferenceIds.size

  if (selectedCount === 0) return null

  const getReference = (id: string): ReferenceImage | null => {
    return allReferences.find((ref) => ref.id === id) || null
  }

  const selectedReferences = Array.from(selectedReferenceIds)
    .map((id) => ({ id, ref: getReference(id) }))
    .filter((item): item is { id: string; ref: ReferenceImage } => item.ref !== null)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1.5 h-7 px-2 text-xs"
        >
          <Images className="h-3.5 w-3.5" />
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium bg-blue-500 text-white rounded-full">
            {selectedCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">選択中の参照画像</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAllReferences}
            disabled={disabled}
            className="h-6 text-xs px-2 text-gray-500 hover:text-gray-700"
          >
            すべて解除
          </Button>
        </div>
        <ScrollArea className="max-h-60">
          <div className="flex flex-wrap gap-2">
            {selectedReferences.map(({ id, ref }) => (
              <div
                key={id}
                className="relative flex-shrink-0 w-20 rounded-lg border-2 border-blue-500 overflow-hidden group"
              >
                <img
                  src={ref.dataUrl}
                  alt={ref.name}
                  className="w-full aspect-video object-cover"
                />
                <button
                  className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  onClick={() => onRemoveReference(id)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <p className="text-[10px] text-white truncate">{ref.name}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
