import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FolderOpen, Settings, Clock, Trash2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectStore } from '@/stores/projectStore'
import { extractImagesFromPdf } from '@/lib/pdf'
import { loadProjectFromZip } from '@/lib/projectFile'
import { isOpfsSupported } from '@/lib/opfs'

export function HomePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const [loadingMessage, setLoadingMessage] = useState('')

  const {
    isLoading,
    setProject,
    createProject,
    setLoading,
    appSettings,
    projectHistory,
    loadProjectHistory,
    loadFromOpfs,
    deleteFromOpfs
  } = useProjectStore()

  const isApiKeyMissing = !appSettings.apiKey
  const hasOpfsSupport = isOpfsSupported()

  // 起動時に履歴を読み込む
  useEffect(() => {
    if (hasOpfsSupport) {
      loadProjectHistory()
    }
  }, [hasOpfsSupport, loadProjectHistory])

  const handleUploadPdf = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleLoadProject = useCallback(() => {
    projectInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        setLoadingMessage('PDFを読み込み中...')
        setLoading(true)
        const slides = await extractImagesFromPdf(file)
        const projectName = file.name.replace(/\.pdf$/i, '')
        const project = createProject(projectName, slides)
        setProject(project)

        navigate('/editor')
      } catch (error) {
        console.error('Failed to load PDF:', error)
        alert('PDFの読み込みに失敗しました。')
      } finally {
        setLoading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [createProject, navigate, setLoading, setProject]
  )

  const handleProjectFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        setLoadingMessage('プロジェクトを読み込み中...')
        setLoading(true)
        const project = await loadProjectFromZip(file)
        setProject(project)

        navigate('/editor')
      } catch (error) {
        console.error('Failed to load project:', error)
        alert('プロジェクトファイルの読み込みに失敗しました。')
      } finally {
        setLoading(false)
        if (projectInputRef.current) {
          projectInputRef.current.value = ''
        }
      }
    },
    [navigate, setLoading, setProject]
  )

  const handleOpenSettings = useCallback(() => {
    navigate('/settings')
  }, [navigate])

  const handleOpenFromHistory = useCallback(
    async (projectId: string) => {
      setLoadingMessage('プロジェクトを読み込み中...')
      const success = await loadFromOpfs(projectId)
      if (success) {
        navigate('/editor')
      } else {
        alert('プロジェクトの読み込みに失敗しました。')
      }
    },
    [loadFromOpfs, navigate]
  )

  const handleDeleteFromHistory = useCallback(
    async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation()
      if (confirm('このプロジェクトのデータを完全に削除しますか？')) {
        await deleteFromOpfs(projectId)
      }
    },
    [deleteFromOpfs]
  )

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">SlideFlow</h1>
        <Button variant="ghost" size="icon" onClick={handleOpenSettings}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          {isApiKeyMissing && (
            <section>
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <svg
                        width="64"
                        height="64"
                        viewBox="0 0 64 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-amber-600"
                      >
                        <circle
                          cx="20"
                          cy="20"
                          r="14"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <path
                          d="M30 30 L38 38"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <rect
                          x="36"
                          y="34"
                          width="8"
                          height="12"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          fill="none"
                          transform="rotate(45 40 40)"
                        />
                        <path
                          d="M44 28 L52 28"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M52 28 L48 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M52 28 L48 32"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <circle
                          cx="52"
                          cy="48"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <path
                          d="M48 48 L50 50 L56 44"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="mb-2 text-lg text-amber-800">
                        APIキーの設定が必要です
                      </CardTitle>
                      <CardDescription className="text-amber-700">
                        <div>SlideFlowを使用するには、Google Gemini APIキーが必要です。</div>
                        <div className="mt-1 flex items-center">
                          <span>右上の</span>
                          <span className="mx-1 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5">
                            <Settings className="mr-1 h-4 w-4" />
                            設定
                          </span>
                          <span>から登録してください。</span>
                        </div>
                        <div>
                          APIキーはGoogle Cloud ConsoleのGenAI
                          Studioから取得できます。組織で利用する場合は管理者の方にコンタクトして取得してください。
                        </div>
                      </CardDescription>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
                        onClick={handleOpenSettings}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        設定を開く
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">ファイルから始める</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={handleUploadPdf}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <Upload className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">PDFをアップロード</CardTitle>
                      <CardDescription>NotebookLMで作成した画像PDFを読み込みます</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={handleLoadProject}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-100 p-2">
                      <FolderOpen className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">プロジェクトを開く</CardTitle>
                      <CardDescription>保存したプロジェクトファイルを読み込みます</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </section>

          {/* 最近のプロジェクト */}
          {hasOpfsSupport && projectHistory.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Clock className="h-5 w-5" />
                最近のプロジェクト(最大10件)
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {projectHistory.map((entry) => (
                  <Card
                    key={entry.id}
                    className="group min-w-0 cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                    onClick={() => handleOpenFromHistory(entry.id)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex gap-3">
                        {entry.thumbnailDataUrl ? (
                          <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded border bg-gray-100">
                            <img
                              src={entry.thumbnailDataUrl}
                              alt={entry.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded border bg-gray-100">
                            <FolderOpen className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-start justify-between gap-1">
                            <CardTitle className="min-w-0 flex-1 truncate text-sm">
                              {entry.name}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => handleDeleteFromHistory(e, entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                            </Button>
                          </div>
                          <CardDescription className="mt-1 text-xs">
                            {entry.slideCount}枚のスライド
                          </CardDescription>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <CardDescription className="min-w-0 flex-1 truncate text-xs text-gray-400">
                              {formatDate(entry.updatedAt)}
                            </CardDescription>
                            {entry.editCount > 0 && (
                              <span className="flex flex-shrink-0 items-center gap-0.5 text-xs text-blue-600">
                                <History className="h-3 w-3" />
                                {entry.editCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".sfpj"
        className="hidden"
        onChange={handleProjectFileChange}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-64">
            <CardHeader className="items-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <CardDescription>{loadingMessage || '処理中...'}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  )
}
