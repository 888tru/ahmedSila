import { clearSession, getAuthState, setSession, type AuthUser } from '@/lib/auth'
import { refreshAccessToken, request } from '@/lib/http'

interface UserResponse {
  id: string
  email: string
  full_name: string
  role: string
  permissions: string[]
}

interface LoginResponse {
  access_token: string
  user: UserResponse
}

function toAuthUser(u: UserResponse): AuthUser {
  return { id: u.id, email: u.email, fullName: u.full_name, role: u.role, permissions: u.permissions }
}

export async function login(email: string, password: string): Promise<void> {
  const body = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setSession(body.access_token, toAuthUser(body.user))
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST' })
  } finally {
    // Разлогинить локально нужно даже если запрос не дошёл: сотрудник ждёт
    // экран логина, а не тихую ошибку в консоли.
    clearSession()
  }
}

/**
 * Восстанавливает сессию по refresh-cookie при заходе на пустой access-токен
 * (открыли вкладку заново). Access-токен намеренно не переживает перезагрузку
 * страницы (см. lib/auth.ts) — единственный способ узнать, что сессия ещё
 * жива, это спросить бэкенд.
 */
export async function restoreSession(): Promise<void> {
  if (!(await refreshAccessToken())) {
    clearSession()
    return
  }
  try {
    const me = await request<UserResponse>('/me')
    const { accessToken } = getAuthState()
    // refreshAccessToken() выше уже положил токен в стор — читаем его оттуда,
    // а не гоняем ещё один запрос за тем же самым
    setSession(accessToken ?? '', toAuthUser(me))
  } catch {
    clearSession()
  }
}
