import { mockStore, OPEN_TICKETS } from '@/features/clients/mock'
import type { Overview, OverviewEvent, ExpiringTrial } from './types'

/*
  Демо-данные «Обзора». Живёт, пока в бэкенде нет `GET /overview`
  (см. CLAUDE.md, «Состояние»), и удаляется вместе с мок-стором клиентов.

  Числа и триалы считаются по тому же мок-стору, что и остальные экраны:
  создали клиента — метрика выросла, приостановили доступ — переехал в
  «на паузе». Иначе «Обзор» врал бы сразу после первой же мутации.
*/

/** За сколько дней считаются дельты. */
const PERIOD_DAYS = 7

/** Насколько вперёд смотрим в «Триал заканчивается скоро». */
const TRIAL_HORIZON_DAYS = 14

/** Сколько строк помещается в панель, не превращая её в отдельный экран. */
const TRIALS_SHOWN = 5

/*
  Дельты — единственное, что нельзя посчитать по текущему состоянию стора:
  нужна история, а её в моке нет. Числа фиксированные и подобраны так, чтобы
  на экране были и рост, и падение, и показатель без сравнения.
*/
const DELTAS = {
  activeClients: 4,
  trialClients: 2,
  openTickets: -3,
  pausedClients: null,
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60_000).toISOString()

const EVENTS: readonly OverviewEvent[] = [
  { id: 'e1', occurredAt: hoursAgo(3), kind: 'ticket_opened', text: 'Новое обращение от «Береке Супермаркет»: не приходит код подтверждения' },
  { id: 'e2', occurredAt: hoursAgo(4), kind: 'other', text: 'Айдар сгенерировал новый код подтверждения для «Береке Супермаркет»' },
  { id: 'e3', occurredAt: hoursAgo(6), kind: 'client_created', text: 'Новый клиент: «Ак Ниет Маркет», Актобе, тариф Starter' },
  { id: 'e4', occurredAt: hoursAgo(21), kind: 'ticket_opened', text: 'Новое обращение от «Смак на Абая»: добавить сотрудника сверх лимита' },
  { id: 'e5', occurredAt: hoursAgo(24), kind: 'access_paused', text: 'Динара приостановила доступ «Наурыз Продукты», причина: просрочка оплаты' },
  { id: 'e6', occurredAt: hoursAgo(27), kind: 'client_activated', text: '«Титан Ритейл» перешёл с триала на тариф Growth' },
  { id: 'e7', occurredAt: hoursAgo(43), kind: 'client_created', text: 'Новый клиент: «Родник», Актау, тариф Starter' },
]

export function buildOverview(): Overview {
  const clients = mockStore.listClients()
  const now = Date.now()
  const horizon = now + TRIAL_HORIZON_DAYS * 24 * 60 * 60_000

  const expiringTrials: ExpiringTrial[] = clients
    .flatMap<ExpiringTrial>((client) =>
      client.status === 'trial' && client.trialEndsAt
        ? [{ clientId: client.id, name: client.name, endsAt: client.trialEndsAt }]
        : [],
    )
    .filter((trial) => new Date(trial.endsAt).getTime() <= horizon)
    .sort((a, b) => a.endsAt.localeCompare(b.endsAt))
    .slice(0, TRIALS_SHOWN)

  const count = (status: string) => clients.filter((client) => client.status === status).length

  return {
    periodDays: PERIOD_DAYS,
    totalClients: clients.length,
    metrics: [
      { key: 'activeClients', value: count('active'), delta: DELTAS.activeClients },
      { key: 'trialClients', value: count('trial'), delta: DELTAS.trialClients },
      { key: 'openTickets', value: OPEN_TICKETS, delta: DELTAS.openTickets },
      { key: 'pausedClients', value: count('paused'), delta: DELTAS.pausedClients },
    ],
    expiringTrials,
    // Лента событий статична: общего журнала в моке нет, он появится вместе
    // с экраном из PAGES.md §6.
    events: clients.length === 0 ? [] : EVENTS.map((event) => ({ ...event })),
  }
}
