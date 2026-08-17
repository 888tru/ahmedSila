import { request, USE_MOCK } from '@/lib/http'
import { mockStore } from './mock'
import type { Client, ClientDetail, JournalEntry, NewClient, Ticket } from './types'

/*
  Слой доступа к данным по клиентам.

  Ручек по клиентам в бэкенде ещё нет — закрыт только контур аутентификации
  (см. CLAUDE.md, «Состояние»). Пока каждый вызов уходит в мок-стор, но
  сигнатуры и форма ответа уже такие, какими их вернёт API: время в ISO,
  id строкой. Когда ручки появятся, меняются только тела функций ниже.
*/

export async function fetchClients(signal?: AbortSignal): Promise<Client[]> {
  if (USE_MOCK) return mockStore.listClients()
  return request<Client[]>('/clients', { signal })
}

export async function fetchClient(id: string, signal?: AbortSignal): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.getClient(id)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return request<ClientDetail>(`/clients/${id}`, { signal })
}

export async function fetchClientTickets(id: string, signal?: AbortSignal): Promise<Ticket[]> {
  if (USE_MOCK) return mockStore.listTickets(id)
  return request<Ticket[]>(`/clients/${id}/tickets`, { signal })
}

export async function fetchClientJournal(
  id: string,
  signal?: AbortSignal,
): Promise<JournalEntry[]> {
  if (USE_MOCK) return mockStore.listJournal(id)
  return request<JournalEntry[]>(`/clients/${id}/journal`, { signal })
}

/**
 * Заводит клиента и сразу возвращает карточку с первым кодом подтверждения:
 * код показывается один раз в модалке после сохранения, отдельной ручки за ним
 * ходить не нужно.
 */
export async function createClient(input: NewClient): Promise<ClientDetail> {
  if (USE_MOCK) return mockStore.create(input)
  return request<ClientDetail>('/clients', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Занят ли email другим клиентом. Отдельным запросом, а не проверкой по
 * загруженному списку: список клиентов email не отдаёт, и он всё равно был бы
 * устаревшим. Ошибка должна появиться у поля сразу, а не после отправки формы
 * (PAGES.md §4.1), поэтому проверка идёт по ходу заполнения.
 */
export async function isEmailTaken(email: string, signal?: AbortSignal): Promise<boolean> {
  if (USE_MOCK) return mockStore.isEmailTaken(email)
  const result = await request<{ taken: boolean }>(
    `/clients/email-taken?email=${encodeURIComponent(email)}`,
    { signal },
  )
  return result.taken
}

/**
 * Причина обязательна: она уходит в `suspended_reason` и в журнал действий,
 * поэтому проверяется и на форме, и здесь — вызов без неё это баг вызывающего.
 */
export async function suspendClient(id: string, reason: string): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.suspend(id, reason)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return request<ClientDetail>(`/clients/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function resumeClient(id: string): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.resume(id)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return request<ClientDetail>(`/clients/${id}/resume`, { method: 'POST' })
}

export async function issueActivationCode(id: string): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.issueActivationCode(id)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return request<ClientDetail>(`/clients/${id}/activation-code`, { method: 'POST' })
}

export async function deleteClient(id: string): Promise<void> {
  if (USE_MOCK) {
    mockStore.remove(id)
    return
  }
  await request<void>(`/clients/${id}`, { method: 'DELETE' })
}
