import { Wand2, Loader2, History, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { SelectedReferencesPopover } from './SelectedReferencesPopover'
import { useSlideEditorStore } from '@/stores/slideEditorStore'
import type { ReferenceImage } from '@/types/referenceImage'

interface PromptInputAreaProps {
  slideId: string
  onEdit: () => void
  isSlideProcessing: boolean
  onOpenDrawer: () => void
  allReferences: ReferenceImage[]
  hasOcrResult: boolean
}

export function PromptInputArea({
  slideId,
  onEdit,
  isSlideProcessing,
  onOpenDrawer,
  allReferences,
  hasOcrResult
}: PromptInputAreaProps) {
  const {
    processingSlides,
    getSlideEditState,
    setSlidePrompt,
    removeSlideReference,
    clearSlideReferences,
    toggleSlideReferencePanel,
    setSlideIncludeOcrResult
  } = useSlideEditorStore()

  const editState = getSlideEditState(slideId)
  const { prompt, selectedReferenceIds, showReferencePanel, includeOcrResult } = editState
  const isEditExecuting = processingSlides[slideId]?.type === 'edit'

  const getReference = (id: string): ReferenceImage | null => {
    return allReferences.find((ref) => ref.id === id) || null
  }

  const selectedReferences = Array.from(selectedReferenceIds)
    .map((id) => ({ id, ref: getReference(id) }))
    .filter((item): item is { id: string; ref: ReferenceImage } => item.ref !== null)

  const handlePromptChange = (value: string) => {
    setSlidePrompt(slideId, value)
  }

  const handleRemoveReference = (id: string) => {
    removeSlideReference(slideId, id)
  }

  const handleClearAllReferences = () => {
    clearSlideReferences(slideId)
  }

  const handleToggleReferencePanel = () => {
    toggleSlideReferencePanel(slideId)
  }

  const handleIncludeOcrChange = (checked: boolean) => {
    setSlideIncludeOcrResult(slideId, checked)
  }

  return (
    <div className="p-4 flex flex-col gap-2 h-full overflow-hidden">
      {/* Top row: Reference button + Selected References + History button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleReferencePanel}
          disabled={isEditExecuting}
          className="gap-1 text-gray-600 flex-shrink-0"
        >
          {showReferencePanel ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          参照画像
        </Button>

        {/* Selected References - Responsive display */}
        {selectedReferenceIds.size > 0 && (
          <>
            <span className="text-xs text-gray-400 flex-shrink-0">|</span>

            {/* Compact badge for narrow screens */}
            <div className="flex-shrink-0 lg:hidden">
              <SelectedReferencesPopover
                selectedReferenceIds={selectedReferenceIds}
                allReferences={allReferences}
                onRemoveReference={handleRemoveReference}
                onClearAllReferences={handleClearAllReferences}
                disabled={isEditExecuting}
              />
            </div>

            {/* Inline thumbnails for wide screens */}
            <div className="hidden lg:flex items-center gap-1 flex-1 min-w-0">
              <span className="text-xs text-gray-500 flex-shrink-0">参照中:</span>
              <ScrollArea className="flex-1">
                <div className="flex items-center gap-1 w-max">
                  {selectedReferences.map(({ id, ref }) => (
                    <div
                      key={id}
                      className="relative flex-shrink-0 w-10 h-6 rounded border-2 border-blue-500 overflow-hidden group"
                    >
                      <img
                        src={ref.dataUrl}
                        alt={ref.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        onClick={() => handleRemoveReference(id)}
                        disabled={isEditExecuting}
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllReferences}
                disabled={isEditExecuting}
                className="h-6 text-xs flex-shrink-0 px-2"
              >
                解除
              </Button>
            </div>
          </>
        )}

        {/* Spacer to push history button to right */}
        <div className="flex-1 lg:hidden" />
        {selectedReferenceIds.size === 0 && <div className="hidden lg:block flex-1" />}

        {/* History button */}
        <Button variant="outline" size="sm" onClick={onOpenDrawer} className="gap-1 flex-shrink-0">
          <History className="h-4 w-4" />
          履歴
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main input area - responsive layout */}
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* Textarea */}
        <Textarea
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="編集の指示を入力してください（例：背景を青空に変更、テキストのフォントを大きく）"
          className="flex-1 resize-none min-h-0 md:min-h-0 min-h-[60px]"
          disabled={isEditExecuting}
        />

        {/* Edit button area */}
        <div className="flex flex-col justify-end gap-2 flex-shrink-0">
          {/* OCR checkbox */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <Checkbox
              checked={includeOcrResult}
              onCheckedChange={(checked) => handleIncludeOcrChange(checked === true)}
              disabled={isEditExecuting || isSlideProcessing}
            />
            <span>OCR結果を含める</span>
          </label>

          {/* Edit button */}
          <Button
            onClick={onEdit}
            disabled={isSlideProcessing || !prompt.trim()}
            className="w-full md:w-auto md:min-w-[100px]"
          >
            {isEditExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                編集中...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                編集
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
