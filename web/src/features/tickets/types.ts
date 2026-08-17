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

/** Сотрудники, на которых можно назначить обращение. */
export const ASSIGNEES = ['Айдар К.', 'Динара Т.', 'Сауле М.'] as const

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
  messages: TicketMessage[]
}

/** Ключ фильтра-чипа по статусу: «Все» плюс каждый статус. */
export type TicketStatusFilter = 'all' | TicketStatus

/** Ключ фильтра-чипа по сотруднику: «Все», конкретное имя или «без назначения». */
export type TicketAssigneeFilter = 'all' | 'unassigned' | (typeof ASSIGNEES)[number]
