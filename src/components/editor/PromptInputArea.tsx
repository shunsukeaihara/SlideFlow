import { Wand2, Loader2, History, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ReferenceImage } from '@/types/referenceImage'

interface PromptInputAreaProps {
  prompt: string
  onPromptChange: (value: string) => void
  onEdit: () => void
  isEditExecuting: boolean
  isSlideProcessing: boolean
  showReferencePanel: boolean
  onToggleReferencePanel: () => void
  selectedReferenceIds: Set<string>
  onRemoveReference: (id: string) => void
  onClearAllReferences: () => void
  onOpenDrawer: () => void
  allReferences: ReferenceImage[]
}

export function PromptInputArea({
  prompt,
  onPromptChange,
  onEdit,
  isEditExecuting,
  isSlideProcessing,
  showReferencePanel,
  onToggleReferencePanel,
  selectedReferenceIds,
  onRemoveReference,
  onClearAllReferences,
  onOpenDrawer,
  allReferences
}: PromptInputAreaProps) {
  const getReference = (id: string): ReferenceImage | null => {
    return allReferences.find((ref) => ref.id === id) || null
  }

  return (
    <div className="p-4 flex flex-col gap-2 h-full overflow-hidden">
      {/* Top row: Reference button + Selected References + History button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleReferencePanel}
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

        {/* Selected References */}
        {selectedReferenceIds.size > 0 && (
          <>
            <span className="text-xs text-gray-400 flex-shrink-0">|</span>
            <span className="text-xs text-gray-500 flex-shrink-0">参照中:</span>
            <div className="flex items-center gap-1 overflow-x-auto flex-1">
              {Array.from(selectedReferenceIds).map((id) => {
                const ref = getReference(id)
                if (!ref) return null

                return (
                  <div
                    key={id}
                    className="relative flex-shrink-0 w-10 h-6 rounded border-2 border-blue-500 overflow-hidden"
                  >
                    <img
                      src={ref.dataUrl}
                      alt={ref.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl hover:bg-red-600 disabled:opacity-50"
                      onClick={() => onRemoveReference(id)}
                      disabled={isEditExecuting}
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </div>
                )
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAllReferences}
              disabled={isEditExecuting}
              className="h-6 text-xs flex-shrink-0 px-2"
            >
              解除
            </Button>
          </>
        )}

        {/* Spacer to push history button to right */}
        {selectedReferenceIds.size === 0 && <div className="flex-1" />}

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
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="編集の指示を入力してください（例：背景を青空に変更、テキストのフォントを大きく）"
          className="flex-1 resize-none min-h-0 md:min-h-0 min-h-[60px]"
          disabled={isEditExecuting}
        />

        {/* Edit button */}
        <div className="flex flex-col justify-end flex-shrink-0">
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
