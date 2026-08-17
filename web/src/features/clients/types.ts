/** Статус клиента в интерфейсе. В коде — tenant, для пользователя — «Клиент». */
export type ClientStatus = 'active' | 'trial' | 'paused'

export type ClientPlan = 'Starter' | 'Growth' | 'Enterprise'

export interface Client {
  id: string
  name: string
  city: string
  status: ClientStatus
  plan: ClientPlan
  /** Сколько сотрудников клиент завёл в своей системе. */
  employees: number
  /** ISO-время последнего входа клиента в систему. */
  lastActiveAt: string
  /** ISO-дата создания клиента. */
  createdAt: string
  /**
   * ISO-дата окончания пробного периода. Есть только у `status === 'trial'`:
   * по ней «Обзор» собирает список тех, с кем нужно связаться до окончания.
   */
  trialEndsAt?: string
}

/** Карточка клиента: то же плюс поля, которые не нужны в списке. */
export interface ClientDetail extends Client {
  address: string
  ownerName: string
  phone: string
  email: string
  openTickets: number
  /** Причина приостановки — заполнена, только когда status === 'paused'. */
  suspendedReason?: string
  /** Выданный код подтверждения; исчезает после активации клиентом. */
  activationCode?: { code: string; expiresAt: string }
}

/**
 * Что нужно бэкенду, чтобы завести клиента (PAGES.md §4.1).
 *
 * Город отдельным полем нет: в форме это одна строка «Город и адрес», как её
 * диктует клиент по телефону. Раскладывать её на город и улицу — задача
 * приёмной стороны, не формы.
 */
export interface NewClient {
  name: string
  address: string
  ownerName: string
  phone: string
  email: string
  plan: ClientPlan
  /** Длительность пробного периода; 0 — клиент активируется сразу. */
  trialDays: number
}

/** Тарифы с пояснением: под выбором показываем, что именно входит в тариф. */
export const PLANS: ReadonlyArray<{ key: ClientPlan; hint: string }> = [
  { key: 'Starter', hint: 'До 15 сотрудников, базовые задачи и смены' },
  { key: 'Growth', hint: 'До 60 сотрудников, заявки на закупку, приоритетная поддержка' },
  { key: 'Enterprise', hint: 'Без ограничения по сотрудникам, отдельный менеджер' },
]

/** Ключ фильтра-чипа: «Все» плюс каждый из статусов. */
export type ClientFilter = 'all' | ClientStatus

export const STATUS_LABEL: Record<ClientStatus, string> = {
  active: 'Активен',
  trial: 'Триал',
  paused: 'На паузе',
}

export const FILTERS: ReadonlyArray<{ key: ClientFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'trial', label: 'Триал' },
  { key: 'paused', label: 'На паузе' },
]

/* ---------------------------------------------------------------- обращения */

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Открыто',
  in_progress: 'В работе',
  resolved: 'Решено',
  closed: 'Закрыто',
}

/** Автор сообщения: клиент или кто-то из команды суперадминки. */
export type MessageAuthor = 'client' | 'team'

export interface TicketMessage {
  id: string
  author: MessageAuthor
  /** Имя автора; для клиента — контактное лицо. */
  authorName: string
  sentAt: string
  text: string
}

export interface Ticket {
  id: string
  clientId: string
  subject: string
  status: TicketStatus
  /** Не назначен — null, а не строка «Не назначен»: подпись живёт в интерфейсе. */
  assignee: string | null
  lastMessageAt: string
  messages: TicketMessage[]
}

/* ------------------------------------------------------------------ журнал */

export interface JournalEntry {
  id: string
  occurredAt: string
  /**
   * Готовая читаемая строка без технических ID — журнал показывает, что
   * человек сделал, а не какие поля изменились (PAGES.md §3.3).
   */
  text: string
}
