import { useState, useCallback } from 'react'
import { ArrowLeft, Eye, EyeOff, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectStore } from '@/stores/projectStore'
import { useAppRouter } from '@/hooks/useAppRouter'
import { useShowApiKeyUI } from '@/hooks/useShowApiKeyUI'
import { useGemini } from '@/context/GeminiContext'
import { initializeGemini } from '@/lib/gemini'

export function SettingsPage() {
  const router = useAppRouter()
  const showApiKeyUI = useShowApiKeyUI()
  const gemini = useGemini()
  const { project, appSettings, setApiKey, setBasePrompt } = useProjectStore()

  const [apiKeyInput, setApiKeyInput] = useState(appSettings.apiKey)
  const [basePromptInput, setBasePromptInput] = useState(project?.settings.basePrompt || '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleSave = useCallback(async () => {
    // APIキーをlocalStorageに保存 (only in client mode)
    if (showApiKeyUI) {
      setApiKey(apiKeyInput)
      if (apiKeyInput) {
        initializeGemini(apiKeyInput)
      }
    }
    if (project) {
      setBasePrompt(basePromptInput)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [apiKeyInput, basePromptInput, project, setApiKey, setBasePrompt, showApiKeyUI])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">設定</h1>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          {saved ? '保存しました' : '保存'}
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* API設定 - only shown in client mode */}
          {showApiKeyUI && (
            <Card>
              <CardHeader>
                <CardTitle>API設定</CardTitle>
                <CardDescription>
                  Gemini APIを使用するためのAPIキーを設定します。
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-blue-600 hover:underline"
                  >
                    APIキーを取得
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Google AI API Key</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIza..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    APIキーはブラウザのlocalStorageに保存され、Gemini
                    APIへのリクエストにのみ使用されます。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {project && (
            <Card>
              <CardHeader>
                <CardTitle>プロジェクト設定</CardTitle>
                <CardDescription>
                  現在のプロジェクト「{project.name}」の設定を変更します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="basePrompt">共通プロンプト</Label>
                  <Textarea
                    id="basePrompt"
                    value={basePromptInput}
                    onChange={(e) => setBasePromptInput(e.target.value)}
                    placeholder="すべての編集リクエストに共通で適用される指示を入力してください（例：日本語で応答してください。スライドのデザインを統一してください。）"
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-gray-500">
                    共通プロンプトは、すべての画像編集・生成リクエストの先頭に追加されます。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>アプリケーション情報</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">バージョン</dt>
                  <dd className="font-medium">1.0.0</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">使用モデル</dt>
                  <dd className="font-medium">gemini-3-pro-image-preview (Nano Banana Pro)</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">実行モード</dt>
                  <dd className="font-medium">{gemini.mode === 'server' ? 'サーバーサイド' : 'クライアントサイド'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
