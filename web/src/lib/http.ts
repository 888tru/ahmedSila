/*
  Транспорт до бэкенда — один на все разделы.

  Ручки по клиентам, обращениям, команде, журналу и настройкам теперь
  реально существуют (см. CLAUDE.md, «Состояние»), поэтому `USE_MOCK` по
  умолчанию выключен. Каждый `api.ts` под этим флагом ещё умеет уходить
  в свой мок-стор — это осталось как аварийный откат и для офлайн-разработки
  фронтенда без поднятого бэкенда, а не основной путь.
*/

import { clearSession, getAuthState, updateAccessToken } from './auth'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const BASE = '/api/v1'

interface Envelope<T> {
  data: T
}

interface ErrorBody {
  code: string
  message: string
  field?: string
}

/** ApiError несёт код и поле от бэкенда — форма ошибок форм ищет их (см. response.go). */
export class ApiError extends Error {
  status: number
  code: string
  field?: string

  constructor(status: number, body: ErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.field = body.field
  }
}

async function parseErrorBody(response: Response): Promise<ErrorBody> {
  try {
    const parsed = (await response.json()) as { error?: ErrorBody }
    if (parsed.error) return parsed.error
  } catch {
    // тело не JSON — редкий случай (502 от прокси и т.п.), падаем на дефолт ниже
  }
  return { code: 'unknown', message: `Ошибка ${response.status}` }
}

/*
  Конкурентные 401 (несколько запросов сорвались разом при протухшем токене)
  не должны запускать несколько refresh параллельно: refresh-токен ротируется
  на каждое обращение, и второй же вызов получил бы уже использованный токен —
  бэкенд трактует это как утечку и отзывает всю сессию (см. CLAUDE.md, «грабли»
  про reuse detection). Одна in-flight обещание на всех дожидающихся.
*/
let refreshPromise: Promise<boolean> | null = null

export function refreshAccessToken(): Promise<boolean> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

async function doRefresh(): Promise<boolean> {
  const response = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) return false
  const body = (await response.json()) as Envelope<{ access_token: string }>
  updateAccessToken(body.data.access_token)
  return true
}

export async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const { accessToken } = getAuthState()
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
  if (init?.body) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    // refresh-токен живёт в httpOnly cookie на /api/v1/auth — без этого
    // браузер её не отправит и не сохранит (см. handler.DefaultCookieConfig)
    credentials: 'include',
  })

  if (response.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) {
      return request<T>(path, init, true)
    }
    clearSession()
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response))
  }
  // DELETE отвечает 204 без тела — json() на нём падает
  if (response.status === 204) return undefined as T

  const body = (await response.json()) as Envelope<T>
  return body.data
}
