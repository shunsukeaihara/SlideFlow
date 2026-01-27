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
    <div className="p-4 flex flex-col gap-3 h-full overflow-hidden">
      {/* Selected References - shown above textarea */}
      {selectedReferenceIds.size > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-sm text-gray-500 flex-shrink-0">参照中:</span>
          <div className="flex items-center gap-2 overflow-x-auto">
            {Array.from(selectedReferenceIds).map((id) => {
              const ref = getReference(id)
              if (!ref) return null

              return (
                <div
                  key={id}
                  className="relative flex-shrink-0 w-12 h-8 rounded border-2 border-blue-500 overflow-hidden"
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
            className="h-7 text-xs flex-shrink-0"
          >
            すべて解除
          </Button>
        </div>
      )}

      {/* Main input area - responsive layout */}
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* Left: Reference button (desktop) */}
        <div className="hidden md:flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleReferencePanel}
            disabled={isEditExecuting}
            className="gap-1 text-gray-600 h-auto py-2"
          >
            {showReferencePanel ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            参照画像
          </Button>
        </div>

        {/* Center: Textarea */}
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="編集の指示を入力してください（例：背景を青空に変更、テキストのフォントを大きく）"
          className="flex-1 resize-none min-h-0"
          disabled={isEditExecuting}
        />

        {/* Right: Action buttons (desktop) */}
        <div className="hidden md:flex flex-col gap-2 justify-end">
          <Button
            onClick={onEdit}
            disabled={isSlideProcessing || !prompt.trim()}
            className="min-w-[100px]"
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
          <Button variant="outline" size="sm" onClick={onOpenDrawer} className="gap-1">
            <History className="h-4 w-4" />
            履歴
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile: Buttons row */}
        <div className="flex md:hidden gap-2 justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleReferencePanel}
            disabled={isEditExecuting}
            className="gap-1 text-gray-600"
          >
            {showReferencePanel ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            参照画像
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onOpenDrawer} className="gap-1">
              <History className="h-4 w-4" />
              履歴
            </Button>
            <Button
              onClick={onEdit}
              disabled={isSlideProcessing || !prompt.trim()}
              size="sm"
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
    </div>
  )
}
