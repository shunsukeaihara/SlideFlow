import { ArrowRight } from 'lucide-react'
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

interface SlideInfoDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slide: Slide
  project: Project
  onRevertToHistory: (historyId: string) => void
  onRevertToOriginal: () => void
  getOriginalImageData: (slide: Slide) => Image | undefined
  getCurrentImageData: (slide: Slide) => Image | undefined
}

export function SlideInfoDrawer({
  open,
  onOpenChange,
  slide,
  project,
  onRevertToHistory,
  onRevertToOriginal,
  getOriginalImageData,
  getCurrentImageData
}: SlideInfoDrawerProps) {
  const currentImage = getCurrentImageData(slide)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-[400px] flex-col sm:max-w-[400px]">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>スライド情報</SheetTitle>
          <SheetDescription>スライド {slide.pageNumber} の詳細</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="history" className="mt-4 flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="history" className="flex-1">
              編集履歴
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              詳細
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {/* Edit history entries (newest first) */}
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
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="mb-1 text-xs text-gray-500">Before</p>
                        {project.images[entry.sourceImageId] && (
                          <img
                            src={project.images[entry.sourceImageId].dataUrl}
                            alt="Before"
                            className="w-full rounded border border-gray-200"
                          />
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <div className="flex-1">
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

                {/* Original image entry (at the bottom) */}
                {getOriginalImageData(slide) && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-xs font-medium text-blue-700">オリジナル</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRevertToOriginal}
                        className="h-6 text-xs"
                      >
                        この状態に戻す
                      </Button>
                    </div>
                    <div>
                      <img
                        src={getOriginalImageData(slide)!.dataUrl}
                        alt="Original"
                        className="w-full rounded border border-blue-200"
                      />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {/* Current Image Info */}
                <div>
                  <h4 className="mb-2 text-sm font-medium">現在の画像</h4>
                  {currentImage && (
                    <div className="space-y-3">
                      <img
                        src={currentImage.dataUrl}
                        alt="Current"
                        className="w-full rounded-lg border border-gray-200"
                      />
                      <div className="rounded-lg bg-gray-50 p-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">幅:</span>
                            <span className="ml-2 font-medium">
                              {Math.ceil(currentImage.width * 10) / 10}px
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">高さ:</span>
                            <span className="ml-2 font-medium">
                              {Math.ceil(currentImage.height * 10) / 10}px
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">形式:</span>
                            <span className="ml-2 font-medium">
                              {currentImage.fileType.split('/')[1]?.toUpperCase() || 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">ページ:</span>
                            <span className="ml-2 font-medium">{slide.pageNumber}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* OCR Results */}
                {currentImage?.ocrCache && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">OCR結果</h4>
                    <div className="space-y-2">
                      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                        <span>認識日時: </span>
                        <span>
                          {new Date(currentImage.ocrCache.metadata.timestamp).toLocaleString(
                            'ja-JP'
                          )}
                        </span>
                        <span className="ml-2">
                          ({currentImage.ocrCache.textBlocks.length}ブロック)
                        </span>
                      </div>
                      {currentImage.ocrCache.textBlocks.length > 0 ? (
                        <div className="space-y-2">
                          {currentImage.ocrCache.textBlocks.map((block, index) => (
                            <div
                              key={index}
                              className="rounded-lg border border-gray-200 bg-white p-3"
                            >
                              <p className="whitespace-pre-wrap text-sm text-gray-700">
                                {block.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="text-sm text-gray-500">(テキストなし)</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
