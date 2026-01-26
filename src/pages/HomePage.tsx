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

  const { isLoading, setProject, createProject, setLoading } = useProjectStore()

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
        <h1 className="text-2xl font-bold text-gray-900">EditNoteLM</h1>
        <Button variant="ghost" size="icon" onClick={handleOpenSettings}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
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
