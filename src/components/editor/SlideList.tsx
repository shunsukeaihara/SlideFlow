import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import type { Slide } from '@/types/project'

interface SortableSlideItemProps {
  slide: Slide
  imageDataUrl: string
  isSelected: boolean
  onSelect: () => void
  onAddBefore: () => void
  onAddAfter: () => void
  onDelete: () => void
  canDelete: boolean
}

function SortableSlideItem({
  slide,
  imageDataUrl,
  isSelected,
  onSelect,
  onAddBefore,
  onAddAfter,
  onDelete,
  canDelete
}: SortableSlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
    opacity: isDragging ? 0.8 : 1
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'relative w-full overflow-hidden rounded-lg border-2 transition-all group',
            isSelected ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-300',
            isDragging && 'shadow-xl'
          )}
        >
          <button onClick={onSelect} className="w-full">
            <img src={imageDataUrl} alt={`Slide ${slide.pageNumber}`} className="w-full" />
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {slide.pageNumber}
            </div>
            {slide.editHistory.length > 0 && (
              <div className="absolute right-1 top-1 rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                {slide.editHistory.length}
              </div>
            )}
          </button>
          {/* ドラッグハンドル */}
          <div
            {...attributes}
            {...listeners}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-white" />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onAddBefore}>
          <Plus className="mr-2 h-4 w-4" />
          前にスライドを追加
        </ContextMenuItem>
        <ContextMenuItem onClick={onAddAfter}>
          <Plus className="mr-2 h-4 w-4" />
          後にスライドを追加
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDelete}
          disabled={!canDelete}
          className={cn(!canDelete && 'opacity-50 cursor-not-allowed')}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          スライドを削除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface SlideListProps {
  slides: Array<{
    slide: Slide
    imageDataUrl: string
  }>
  onAddBefore: (index: number) => void
  onAddAfter: (index: number) => void
}

export function SlideList({ slides, onAddBefore, onAddAfter }: SlideListProps) {
  const { selectedSlideId, setSelectedSlide, reorderSlides, deleteSlide } = useProjectStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderSlides(active.id as string, over.id as string)
    }
  }

  const handleDelete = (slideId: string) => {
    if (slides.length <= 1) return
    deleteSlide(slideId)
  }

  const canDelete = slides.length > 1

  return (
    <aside className="w-48 h-full border-r border-gray-200 bg-gray-50">
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={slides.map((s) => s.slide.id)}
              strategy={verticalListSortingStrategy}
            >
              {slides.map(({ slide, imageDataUrl }, index) => (
                <SortableSlideItem
                  key={slide.id}
                  slide={slide}
                  imageDataUrl={imageDataUrl}
                  isSelected={slide.id === selectedSlideId}
                  onSelect={() => setSelectedSlide(slide.id)}
                  onAddBefore={() => onAddBefore(index)}
                  onAddAfter={() => onAddAfter(index)}
                  onDelete={() => handleDelete(slide.id)}
                  canDelete={canDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>
    </aside>
  )
}
