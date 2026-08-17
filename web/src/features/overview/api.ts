import { request, USE_MOCK } from '@/lib/http'
import { buildOverview } from './mock'
import type { Overview } from './types'

/**
 * Весь «Обзор» — один ответ: показатели, ближайшие окончания триалов и лента
 * событий считаются на бэкенде за один проход. Три отдельных запроса дали бы
 * три разных момента времени в одной шапке «обновлено в …».
 */
export async function fetchOverview(signal?: AbortSignal): Promise<Overview> {
  if (USE_MOCK) return buildOverview()
  return request<Overview>('/overview', { signal })
}
