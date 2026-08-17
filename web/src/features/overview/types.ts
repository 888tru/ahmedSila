/*
  «Обзор» — общая картина по всем клиентам сразу (PAGES.md §1).

  Собирается на бэкенде одним ответом, а не складывается на клиенте из списка
  клиентов: дельты к предыдущему периоду требуют истории, которой у фронта нет,
  а события приходят из разных таблиц (клиенты, обращения, аудит).
*/

export type OverviewMetricKey = 'activeClients' | 'trialClients' | 'openTickets' | 'pausedClients'

export interface OverviewMetric {
  key: OverviewMetricKey
  value: number
  /** Изменение к предыдущему периоду. `null` — сравнивать не с чем. */
  delta: number | null
}

/*
  Подписи отдельно от чисел: бэкенд отдаёт показатели, а как они называются
  по-русски — вопрос интерфейса. На «Обзоре» подписи чуть длиннее, чем в
  строке над таблицей клиентов: здесь у них нет контекста таблицы рядом.
*/
export const METRIC_LABEL: Record<OverviewMetricKey, string> = {
  activeClients: 'Активных клиентов',
  trialClients: 'На триале',
  openTickets: 'Открытых обращений',
  pausedClients: 'Клиентов на паузе',
}

/** Клиент, у которого скоро заканчивается пробный период. */
export interface ExpiringTrial {
  clientId: string
  name: string
  /** ISO-дата окончания пробного периода. */
  endsAt: string
}

/**
 * Что именно произошло. Влияет только на цвет точки в ленте: текст события
 * приходит готовой строкой, как и в журнале клиента (PAGES.md §3.3).
 */
export type OverviewEventKind =
  | 'client_created'
  | 'ticket_opened'
  | 'access_paused'
  | 'client_activated'
  | 'other'

export interface OverviewEvent {
  id: string
  occurredAt: string
  kind: OverviewEventKind
  text: string
}

export interface Overview {
  /** За сколько дней посчитаны дельты. */
  periodDays: number
  /** Всего клиентов в системе: ноль — экран показывает приглашение, а не нули. */
  totalClients: number
  metrics: OverviewMetric[]
  expiringTrials: ExpiringTrial[]
  events: OverviewEvent[]
}
