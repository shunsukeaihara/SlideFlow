'use client'

import { useRouter } from 'next/navigation'
import type { AppRouter } from '@/hooks/useAppRouter'

/**
 * Next.js implementation of the AppRouter interface.
 */
export function useAppRouter(): AppRouter {
  const router = useRouter()

  return {
    push: router.push,
    replace: router.replace,
    back: router.back
  }
}
