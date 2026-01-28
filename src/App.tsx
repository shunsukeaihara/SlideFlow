import { useEffect, useMemo } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { EditorPage } from '@/pages/EditorPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useProjectStore } from '@/stores/projectStore'
import { GeminiProvider, type GeminiAPI } from '@/context/GeminiContext'
import { RouterProvider, type AppRouter } from '@/context/RouterContext'
import {
  initializeGemini,
  isGeminiInitialized,
  editImage as clientEditImage,
  generateImageFromReference as clientGenerateImageFromReference,
  refineTesseractResults as clientRefineTesseractResults,
  type ImageEditRequest,
  type ImageGenerateRequest,
  type OcrRefinementRequest
} from '@/lib/gemini'

/**
 * Inner component that provides RouterContext using React Router's useNavigate.
 * Must be rendered inside HashRouter.
 */
function AppRoutes(): React.JSX.Element {
  const navigate = useNavigate()

  // Create router adapter for React Router
  const router: AppRouter = useMemo(
    () => ({
      push: (path: string) => navigate(path),
      replace: (path: string) => navigate(path, { replace: true }),
      back: () => navigate(-1)
    }),
    [navigate]
  )

  return (
    <RouterProvider router={router}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </RouterProvider>
  )
}

function App(): React.JSX.Element {
  const { appSettings } = useProjectStore()

  // APIキーが変更されたらGemini初期化
  // Note: appSettings.apiKey is initialized synchronously from localStorage in the store,
  // so this will run on first render if an API key exists
  useEffect(() => {
    if (appSettings.apiKey) {
      initializeGemini(appSettings.apiKey)
    }
  }, [appSettings.apiKey])

  // Client-side Gemini API implementation
  const clientGeminiAPI: GeminiAPI = useMemo(
    () => ({
      editImage: async (request: ImageEditRequest) => {
        return clientEditImage(request)
      },
      generateImageFromReference: async (request: ImageGenerateRequest) => {
        return clientGenerateImageFromReference(
          request.prompt,
          request.basePrompt,
          request.referenceImageDataUrls
        )
      },
      refineTesseractResults: async (request: OcrRefinementRequest) => {
        // Client mode uses API key from store
        const apiKey = useProjectStore.getState().appSettings.apiKey
        return clientRefineTesseractResults(request.tesseractBlocks, request.imageDataUrl, apiKey)
      },
      isInitialized: isGeminiInitialized,
      mode: 'client'
    }),
    []
  )

  return (
    <GeminiProvider api={clientGeminiAPI}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </GeminiProvider>
  )
}

export default App
