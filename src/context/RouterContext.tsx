'use client'

import { createContext, useContext, type ReactNode } from 'react'

// ============================================================================
// Router Interface
// ============================================================================

export interface AppRouter {
  push: (path: string) => void
  replace: (path: string) => void
  back: () => void
}

// ============================================================================
// Context
// ============================================================================

const RouterContext = createContext<AppRouter | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAppRouter(): AppRouter {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    throw new Error('useAppRouter must be used within RouterProvider')
  }
  return ctx
}

// ============================================================================
// Provider
// ============================================================================

interface RouterProviderProps {
  children: ReactNode
  router: AppRouter
}

export function RouterProvider({ children, router }: RouterProviderProps) {
  return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
}
