import { request, USE_MOCK } from '@/lib/http'
import { mockStore } from './mock'
import type {
  Client,
  ClientDetail,
  ClientPlan,
  ClientStatus,
  JournalEntry,
  NewClient,
  Ticket,
  TicketMessage,
  TicketStatus,
} from './types'

/*
  Слой доступа к данным по клиентам.

  Ручки по клиентам теперь реально есть на бэкенде (см. CLAUDE.md,
  «Состояние») — сигнатуры уже были написаны под них заранее, поэтому здесь
  меняется только тело: снятие мока и перевод snake_case-ответа бэкенда
  в camelCase-форму, которой пользуется остальной фронт.
*/

interface TenantWire {
  id: string
  name: string
  city: string
  status: ClientStatus
  plan: ClientPlan
  employees: number
  last_active_at: string | null
  created_at: string
  trial_ends_at: string | null
}

interface TenantDetailWire extends TenantWire {
  address: string
  owner_name: string
  phone: string
  email: string
  open_tickets: number
  suspended_reason: string | null
  activation_code: { code: string; expires_at: string } | null
}

function toClient(w: TenantWire): Client {
  return {
    id: w.id,
    name: w.name,
    city: w.city,
    status: w.status,
    plan: w.plan,
    employees: w.employees,
    // Ещё не входил — до первого входа показываем момент создания
    // (тот же приём, что раньше был в mock.ts create()).
    lastActiveAt: w.last_active_at ?? w.created_at,
    createdAt: w.created_at,
    trialEndsAt: w.trial_ends_at ?? undefined,
  }
}

function toClientDetail(w: TenantDetailWire): ClientDetail {
  return {
    ...toClient(w),
    address: w.address,
    ownerName: w.owner_name,
    phone: w.phone,
    email: w.email,
    openTickets: w.open_tickets,
    suspendedReason: w.suspended_reason ?? undefined,
    activationCode: w.activation_code
      ? { code: w.activation_code.code, expiresAt: w.activation_code.expires_at }
      : undefined,
  }
}

interface ClientTicketWire {
  id: string
  client_id: string
  subject: string
  status: TicketStatus
  assignee: string | null
  last_message_at: string
  messages: Array<{ id: string; author: TicketMessage['author']; author_name: string; sent_at: string; text: string }>
}

function toTicket(w: ClientTicketWire): Ticket {
  return {
    id: w.id,
    clientId: w.client_id,
    subject: w.subject,
    status: w.status,
    assignee: w.assignee,
    lastMessageAt: w.last_message_at,
    messages: w.messages.map((m) => ({
      id: m.id,
      author: m.author,
      authorName: m.author_name,
      sentAt: m.sent_at,
      text: m.text,
    })),
  }
}

interface ClientJournalEntryWire {
  id: string
  occurred_at: string
  text: string
}

export async function fetchClients(signal?: AbortSignal): Promise<Client[]> {
  if (USE_MOCK) return mockStore.listClients()
  const wire = await request<TenantWire[]>('/clients', { signal })
  return wire.map(toClient)
}

export async function fetchClient(id: string, signal?: AbortSignal): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.getClient(id)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return toClientDetail(await request<TenantDetailWire>(`/clients/${id}`, { signal }))
}

export async function fetchClientTickets(id: string, signal?: AbortSignal): Promise<Ticket[]> {
  if (USE_MOCK) return mockStore.listTickets(id)
  const wire = await request<ClientTicketWire[]>(`/clients/${id}/tickets`, { signal })
  return wire.map(toTicket)
}

export async function fetchClientJournal(
  id: string,
  signal?: AbortSignal,
): Promise<JournalEntry[]> {
  if (USE_MOCK) return mockStore.listJournal(id)
  const wire = await request<ClientJournalEntryWire[]>(`/clients/${id}/journal`, { signal })
  return wire.map((e) => ({ id: e.id, occurredAt: e.occurred_at, text: e.text }))
}

/**
 * Заводит клиента и сразу возвращает карточку с первым кодом подтверждения:
 * код показывается один раз в модалке после сохранения, отдельной ручки за ним
 * ходить не нужно.
 */
export async function createClient(input: NewClient): Promise<ClientDetail> {
  if (USE_MOCK) return mockStore.create(input)
  return toClientDetail(
    await request<TenantDetailWire>('/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        address: input.address,
        owner_name: input.ownerName,
        phone: input.phone,
        email: input.email,
        plan: input.plan,
        trial_days: input.trialDays,
      }),
    }),
  )
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
  return toClientDetail(
    await request<TenantDetailWire>(`/clients/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

export async function resumeClient(id: string): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.resume(id)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return toClientDetail(await request<TenantDetailWire>(`/clients/${id}/resume`, { method: 'POST' }))
}

export async function issueActivationCode(id: string): Promise<ClientDetail> {
  if (USE_MOCK) {
    const client = mockStore.issueActivationCode(id)
    if (!client) throw new Error(`Клиент ${id} не найден`)
    return client
  }
  return toClientDetail(
    await request<TenantDetailWire>(`/clients/${id}/activation-code`, { method: 'POST' }),
  )
}

export async function deleteClient(id: string): Promise<void> {
  if (USE_MOCK) {
    mockStore.remove(id)
    return
  }
  await request<void>(`/clients/${id}`, { method: 'DELETE' })
}
