import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FolderOpen, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectStore } from '@/stores/projectStore'
import { extractImagesFromPdf } from '@/lib/pdf'
import { loadProjectFromZip } from '@/lib/projectFile'

export function HomePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const [loadingMessage, setLoadingMessage] = useState('')

  const { isLoading, setProject, createProject, setLoading, appSettings } = useProjectStore()

  const isApiKeyMissing = !appSettings.apiKey

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
            <h2 className="mb-4 text-lg font-semibold text-gray-900">新規プロジェクト</h2>
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
        </div>
      </main>

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

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-8 shadow-xl">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-lg font-medium text-gray-900">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}
