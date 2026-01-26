import { Wand2, Loader2, History, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ReferenceImage } from '@/types/referenceImage'

interface PromptInputAreaProps {
  prompt: string
  onPromptChange: (value: string) => void
  onEdit: () => void
  isEditing: boolean
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
  isEditing,
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
    <div className="p-4">
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleReferencePanel}
              className="gap-1 text-gray-600"
            >
              {showReferencePanel ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              参照画像
            </Button>

            {/* Selected References - shown next to the button */}
            {selectedReferenceIds.size > 0 && (
              <>
                <div className="flex-1 flex items-center gap-2 overflow-x-auto">
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
                          className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl hover:bg-red-600"
                          onClick={() => onRemoveReference(id)}
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
                  className="h-7 text-xs flex-shrink-0"
                >
                  すべて解除
                </Button>
              </>
            )}
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="編集の指示を入力してください（例：背景を青空に変更、テキストのフォントを大きく）"
            className="min-h-[80px] flex-1 resize-none"
            disabled={isEditing}
          />
        </div>
        <div className="flex flex-col gap-2 justify-end">
          <Button onClick={onEdit} disabled={isEditing || !prompt.trim()} className="min-w-[100px]">
            {isEditing ? (
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
      </div>
    </div>
  )
}
