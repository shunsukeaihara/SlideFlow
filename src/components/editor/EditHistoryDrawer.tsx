import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Slide, Image, Project } from '@/types/project'

interface EditHistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slide: Slide
  project: Project
  onRevertToHistory: (historyId: string) => void
  onRevertToOriginal: () => void
  getOriginalImageData: (slide: Slide) => Image | undefined
}

export function EditHistoryDrawer({
  open,
  onOpenChange,
  slide,
  project,
  onRevertToHistory,
  onRevertToOriginal,
  getOriginalImageData
}: EditHistoryDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>スライド情報</SheetTitle>
          <SheetDescription>スライド {slide.pageNumber} の詳細</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="history" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="history" className="flex-1">
              編集履歴
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              設定
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {slide.editHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-500">まだ編集履歴がありません</div>
              ) : (
                <div className="space-y-4">
                  {[...slide.editHistory].reverse().map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString('ja-JP')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRevertToHistory(entry.id)}
                          className="h-6 text-xs"
                        >
                          この状態に戻す
                        </Button>
                      </div>
                      <p className="mb-2 text-sm text-gray-700">{entry.prompt}</p>
                      {entry.referenceImageIds && entry.referenceImageIds.length > 0 && (
                        <div className="mb-2">
                          <p className="mb-1 text-xs text-gray-500">参照画像</p>
                          <div className="flex gap-1 flex-wrap">
                            {entry.referenceImageIds.map((refId) => {
                              const refImage = project.images[refId]
                              if (!refImage) return null
                              return (
                                <div
                                  key={refId}
                                  className="relative w-12 h-8 rounded border border-gray-200 overflow-hidden"
                                >
                                  <img
                                    src={refImage.dataUrl}
                                    alt="参照画像"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1 text-xs text-gray-500">Before</p>
                          {project.images[entry.sourceImageId] && (
                            <img
                              src={project.images[entry.sourceImageId].dataUrl}
                              alt="Before"
                              className="w-full rounded border border-gray-200"
                            />
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-gray-500">After</p>
                          {project.images[entry.resultImageId] && (
                            <img
                              src={project.images[entry.resultImageId].dataUrl}
                              alt="After"
                              className="w-full rounded border border-gray-200"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium">オリジナル画像</h4>
                {getOriginalImageData(slide) && (
                  <>
                    <img
                      src={getOriginalImageData(slide)!.dataUrl}
                      alt="Original"
                      className="w-full rounded-lg border border-gray-200"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={onRevertToOriginal}
                    >
                      オリジナルに戻す
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
