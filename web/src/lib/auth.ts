/*
  Состояние сессии — вне React, потому что читать и обновлять его должен и
  `request()` в lib/http.ts (обычная функция, не компонент), и любой компонент
  через `useAuth()`. `useSyncExternalStore` — из React 18, отдельного стора
  вроде Zustand заводить незачем ради одного объекта.

  access-токен живёт только в памяти (эта переменная), не в localStorage:
  токен, которого нет на диске, нельзя вытащить через XSS россыпью файлов
  кэша. Пережить обновление страницы ему помогает refresh-токен в httpOnly
  cookie — см. restoreSession в features/auth.
*/

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: string
  permissions: string[]
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  /** Пока не решили, есть ли валидная сессия, экраны не должны мигать логином. */
  status: 'checking' | 'authenticated' | 'anonymous'
}

let state: AuthState = { accessToken: null, user: null, status: 'checking' }
const listeners = new Set<() => void>()

export function getAuthState(): AuthState {
  return state
}

export function setSession(accessToken: string, user: AuthUser): void {
  state = { accessToken, user, status: 'authenticated' }
  notify()
}

export function clearSession(): void {
  state = { accessToken: null, user: null, status: 'anonymous' }
  notify()
}

/** Только токен — после silent refresh пользователь тот же, перезапрашивать незачем. */
export function updateAccessToken(accessToken: string): void {
  state = { ...state, accessToken }
  notify()
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
