import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuth } from './useAuth'

/**
 * Пропускает дальше только с живой сессией. `status === 'checking'` —
 * между открытием вкладки и ответом silent refresh (см. restoreSession в
 * api.ts) — держит пустой экран вместо мигания логином на каждой перезагрузке.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return <div className="min-h-screen bg-canvas" />
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
