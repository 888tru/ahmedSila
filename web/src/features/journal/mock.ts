import type { GlobalJournalEntry } from './types'

/*
  Демо-данные общего журнала. Существуют, пока в бэкенде нет ручки
  `GET /api/v1/journal` (см. CLAUDE.md, «Состояние») — сейчас есть только
  `GET /clients/:id/journal` на одного клиента.

  Даты — «N дней назад», а не фиксированные: иначе через месяц после написания
  мока все записи оказались бы за пределами фильтра «30 дней» (см. тот же
  приём в `features/overview/mock.ts`). `clientId` там, где действие по
  клиенту, указывает на реальную запись в `features/clients/mock.ts`.
*/

const atDaysAgo = (days: number, hour: number, minute: number): string => {
  const date = new Date(Date.now() - days * 24 * 60 * 60_000)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const ENTRIES: readonly GlobalJournalEntry[] = [
  { id: 'j-1', occurredAt: atDaysAgo(2, 11, 42), actor: 'Айдар К.', kind: 'tickets', text: 'Ответил в обращении «Не приходит код подтверждения на почту»', clientId: '5', clientName: 'Береке Супермаркет' },
  { id: 'j-2', occurredAt: atDaysAgo(2, 10, 12), actor: 'Айдар К.', kind: 'access', text: 'Сгенерировал новый код подтверждения', clientId: '5', clientName: 'Береке Супермаркет' },
  { id: 'j-3', occurredAt: atDaysAgo(2, 9, 30), actor: 'Динара Т.', kind: 'clients', text: 'Создала клиента, тариф Starter', clientId: '13', clientName: 'Куаныш Маркет' },
  { id: 'j-4', occurredAt: atDaysAgo(2, 18, 22), actor: 'Сауле М.', kind: 'tickets', text: 'Назначила на себя обращение «Как поменять владельца аккаунта»', clientId: '12', clientName: 'Титан Ритейл' },
  { id: 'j-5', occurredAt: atDaysAgo(3, 15, 20), actor: 'Динара Т.', kind: 'access', text: 'Приостановила доступ, причина: просрочка оплаты', clientId: '14', clientName: 'Наурыз Продукты' },
  { id: 'j-6', occurredAt: atDaysAgo(3, 12, 0), actor: 'Айдар К.', kind: 'subscription', text: 'Перевёл клиента с триала на тариф Growth', clientId: '12', clientName: 'Титан Ритейл' },
  { id: 'j-7', occurredAt: atDaysAgo(4, 16, 48), actor: 'Динара Т.', kind: 'clients', text: 'Создала клиента, тариф Starter', clientId: '16', clientName: 'Родник' },
  { id: 'j-8', occurredAt: atDaysAgo(4, 11, 5), actor: 'Айдар К.', kind: 'access', text: 'Возобновил доступ после подтверждения оплаты', clientId: '4', clientName: 'Айсберг Маркет' },
  { id: 'j-9', occurredAt: atDaysAgo(9, 17, 30), actor: 'Сауле М.', kind: 'team', text: 'Пригласила сотрудника в команду: r.aliev@example.kz, роль «Поддержка»', clientId: null, clientName: null },
  { id: 'j-10', occurredAt: atDaysAgo(12, 14, 2), actor: 'Айдар К.', kind: 'subscription', text: 'Изменил тариф с Growth на Enterprise', clientId: '5', clientName: 'Береке Супермаркет' },
  { id: 'j-11', occurredAt: atDaysAgo(15, 9, 15), actor: 'Динара Т.', kind: 'clients', text: 'Изменила контакты владельца', clientId: '7', clientName: 'Смак на Абая' },
  { id: 'j-12', occurredAt: atDaysAgo(20, 19, 40), actor: 'Айдар К.', kind: 'team', text: 'Отозвал доступ сотрудника команды: m.orazov@example.kz', clientId: null, clientName: null },
  { id: 'j-13', occurredAt: atDaysAgo(35, 10, 26), actor: 'Сауле М.', kind: 'access', text: 'Приостановила доступ, причина: запрос клиента', clientId: '9', clientName: 'Ануар Фрукты' },
  { id: 'j-14', occurredAt: atDaysAgo(50, 13, 11), actor: 'Динара Т.', kind: 'clients', text: 'Создала клиента, тариф Growth', clientId: '11', clientName: 'Апельсин' },
  { id: 'j-15', occurredAt: atDaysAgo(65, 16, 55), actor: 'Айдар К.', kind: 'subscription', text: 'Продлил пробный период на 7 дней', clientId: '6', clientName: 'Дастархан' },
]

export function listJournal(): GlobalJournalEntry[] {
  return ENTRIES.map((entry) => ({ ...entry }))
}
