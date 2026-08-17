import { request, USE_MOCK } from '@/lib/http'
import { listTickets } from './mock'
import type { GlobalTicket } from './types'

/**
 * Все обращения сразу, по всем клиентам (PAGES.md §5) — в отличие от
 * `fetchClientTickets` в `features/clients/api.ts`, который отдаёт то же самое
 * в разрезе одного клиента для вкладки его карточки.
 */
export async function fetchTickets(signal?: AbortSignal): Promise<GlobalTicket[]> {
  if (USE_MOCK) return listTickets()
  return request<GlobalTicket[]>('/tickets', { signal })
}
