import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { EditorPage } from '@/pages/EditorPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useProjectStore } from '@/stores/projectStore'
import { initializeGemini } from '@/lib/gemini'

function App(): React.JSX.Element {
  const { loadApiKey, appSettings } = useProjectStore()

  // 起動時にAPIキーを読み込む
  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])

  // APIキーが変更されたらGemini初期化
  useEffect(() => {
    if (appSettings.apiKey) {
      initializeGemini(appSettings.apiKey)
    }
  }, [appSettings.apiKey])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
