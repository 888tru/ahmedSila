import { request, USE_MOCK } from '@/lib/http'
import { listJournal } from './mock'
import type { GlobalJournalEntry, JournalActionKind } from './types'

interface JournalEntryWire {
  id: number
  occurred_at: string
  actor: string
  kind: JournalActionKind
  text: string
  client_id: string | null
  client_name: string | null
}

function fromWire(e: JournalEntryWire): GlobalJournalEntry {
  return {
    id: String(e.id),
    occurredAt: e.occurred_at,
    actor: e.actor,
    kind: e.kind,
    text: e.text,
    clientId: e.client_id,
    clientName: e.client_name,
  }
}

/**
 * Весь журнал сразу, по всей команде (PAGES.md §6) — в отличие от
 * `fetchClientJournal` в `features/clients/api.ts`, который отдаёт то же самое
 * в разрезе одного клиента для вкладки его карточки.
 */
export async function fetchJournal(signal?: AbortSignal): Promise<GlobalJournalEntry[]> {
  if (USE_MOCK) return listJournal()
  const entries = await request<JournalEntryWire[]>('/journal?limit=200', { signal })
  return entries.map(fromWire)
}
