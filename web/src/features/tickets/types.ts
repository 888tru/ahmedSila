/*
  «Обращения» (PAGES.md §5) — переписка по всем клиентам сразу, в отличие от
  вкладки «Обращения» в карточке клиента (`features/clients/tabs`), которая
  показывает то же самое, но уже отфильтрованным по одному клиенту.

  Статус и сообщения переиспользуются из `features/clients/types`: это одна и
  та же сущность, здесь у неё просто больше контекста (клиент, приоритет,
  контактное лицо), нужного только на общем экране.
*/

import type { TicketMessage, TicketStatus } from '@/features/clients/types'

export type TicketPriority = 'low' | 'normal' | 'high'

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
}

export const PRIORITY_OPTIONS: readonly TicketPriority[] = ['low', 'normal', 'high']

export interface GlobalTicket {
  id: string
  clientId: string
  clientName: string
  city: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  /** Не назначено — null, а не строка: подпись «Не назначен» живёт в интерфейсе. */
  assignee: string | null
  lastMessageAt: string
  /** Контактное лицо клиента — от его имени идут сообщения с `author: 'client'`. */
  contactName: string
}

/**
 * Обращение с полной перепиской — отдельный запрос (`GET /tickets/:id`),
 * а не поле в списке: список нужен весь и сразу, треды — по одному, тащить
 * все сообщения всех обращений в список было бы лишним весом ответа.
 */
export interface GlobalTicketDetail extends GlobalTicket {
  messages: TicketMessage[]
}

/** Ключ фильтра-чипа по статусу: «Все» плюс каждый статус. */
export type TicketStatusFilter = 'all' | TicketStatus

/**
 * Ключ фильтра-чипа по сотруднику: «Все», имя конкретного сотрудника (из
 * реального списка команды, см. useTeam) или «без назначения».
 */
export type TicketAssigneeFilter = 'all' | 'unassigned' | string
