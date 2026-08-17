/*
  Транспорт до бэкенда — один на все разделы.

  Ручек по клиентам и обзору ещё нет (см. CLAUDE.md, «Состояние»), поэтому
  каждый `api.ts` под флагом `USE_MOCK` уходит в свой мок-стор. Здесь только
  то, что не зависит от раздела: базовый путь, разбор ответа и единая ошибка.
*/

/** Снимается через `VITE_USE_MOCK=false`, когда ручки появятся в бэкенде. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const BASE = '/api/v1'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${BASE}${path} → ${response.status}`)
  }
  // DELETE отвечает 204 без тела — json() на нём падает
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
