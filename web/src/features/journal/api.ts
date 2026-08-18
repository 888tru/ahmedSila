import { request, USE_MOCK } from '@/lib/http'
import { listJournal } from './mock'
import type { GlobalJournalEntry } from './types'

/**
 * Весь журнал сразу, по всей команде (PAGES.md §6) — в отличие от
 * `fetchClientJournal` в `features/clients/api.ts`, который отдаёт то же самое
 * в разрезе одного клиента для вкладки его карточки.
 */
export async function fetchJournal(signal?: AbortSignal): Promise<GlobalJournalEntry[]> {
  if (USE_MOCK) return listJournal()
  return request<GlobalJournalEntry[]>('/journal', { signal })
}
