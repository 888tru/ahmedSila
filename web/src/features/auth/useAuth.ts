import { useSyncExternalStore } from 'react'

import { getAuthState, subscribeAuth } from '@/lib/auth'

/** Обёртка над стором авторизации (lib/auth.ts) как React-хук. */
export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthState)
}
