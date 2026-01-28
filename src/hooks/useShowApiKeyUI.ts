import { useGemini } from '../context/GeminiContext'

/**
 * Returns whether to show API key-related UI elements.
 * In client mode, users manage their own API keys (show UI).
 * In server mode, API key is managed by the server (hide UI).
 */
export function useShowApiKeyUI(): boolean {
  const { mode } = useGemini()
  return mode === 'client'
}
