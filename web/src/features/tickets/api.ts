import { request, USE_MOCK } from '@/lib/http'
import type { TicketMessage, TicketStatus } from '@/features/clients/types'
import { getTicket, listTickets } from './mock'
import type { GlobalTicket, GlobalTicketDetail, TicketPriority } from './types'

interface GlobalTicketWire {
  id: string
  client_id: string
  client_name: string
  city: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  assignee: string | null
  contact_name: string
  last_message_at: string
}

interface TicketMessageWire {
  id: string
  author: TicketMessage['author']
  author_name: string
  sent_at: string
  text: string
}

function fromWire(w: GlobalTicketWire): GlobalTicket {
  return {
    id: w.id,
    clientId: w.client_id,
    clientName: w.client_name,
    city: w.city,
    subject: w.subject,
    status: w.status,
    priority: w.priority,
    assignee: w.assignee,
    contactName: w.contact_name,
    lastMessageAt: w.last_message_at,
  }
}

function messageFromWire(m: TicketMessageWire): TicketMessage {
  return { id: m.id, author: m.author, authorName: m.author_name, sentAt: m.sent_at, text: m.text }
}

/**
 * Список сразу по всем клиентам (PAGES.md §5) — без переписки: она весит
 * заметно больше самого списка, а открывают за раз одно обращение
 * (см. `fetchTicket` ниже).
 */
export async function fetchTickets(signal?: AbortSignal): Promise<GlobalTicket[]> {
  if (USE_MOCK) return listTickets()
  const wire = await request<GlobalTicketWire[]>('/tickets', { signal })
  return wire.map(fromWire)
}

export async function fetchTicket(id: string, signal?: AbortSignal): Promise<GlobalTicketDetail> {
  if (USE_MOCK) {
    const ticket = getTicket(id)
    if (!ticket) throw new Error(`Обращение ${id} не найдено`)
    return ticket
  }
  const wire = await request<GlobalTicketWire & { messages: TicketMessageWire[] }>(`/tickets/${id}`, {
    signal,
  })
  return { ...fromWire(wire), messages: wire.messages.map(messageFromWire) }
}

export async function replyToTicket(id: string, text: string): Promise<TicketMessage> {
  if (USE_MOCK) throw new Error('Ответ недоступен в режиме мока')
  const wire = await request<TicketMessageWire>(`/tickets/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return messageFromWire(wire)
}

export async function assignTicketToSelf(id: string): Promise<GlobalTicket> {
  if (USE_MOCK) throw new Error('Назначение недоступно в режиме мока')
  return fromWire(await request<GlobalTicketWire>(`/tickets/${id}/assign`, { method: 'POST' }))
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<GlobalTicket> {
  if (USE_MOCK) throw new Error('Смена статуса недоступна в режиме мока')
  return fromWire(
    await request<GlobalTicketWire>(`/tickets/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  )
}

export async function updateTicketPriority(id: string, priority: TicketPriority): Promise<GlobalTicket> {
  if (USE_MOCK) throw new Error('Смена приоритета недоступна в режиме мока')
  return fromWire(
    await request<GlobalTicketWire>(`/tickets/${id}/priority`, {
      method: 'POST',
      body: JSON.stringify({ priority }),
    }),
  )
}
