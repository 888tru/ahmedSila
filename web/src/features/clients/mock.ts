import type { Client, ClientDetail, JournalEntry, NewClient, Ticket } from './types'

/*
  Демо-данные и мутирующий их стор в памяти.

  Существует, пока в бэкенде нет ручек по клиентам (см. CLAUDE.md, «Состояние»).
  Стор именно мутирующий, а не константа: приостановка доступа, выдача кода и
  удаление должны в интерфейсе вести себя как настоящие — иначе не проверить ни
  инвалидацию кэша, ни то, что экран перерисовывается по ответу сервера.

  Весь файл удаляется целиком вместе с `USE_MOCK` в `api.ts`.
*/

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

/*
  Окончания триалов заданы относительно «сейчас», а не фиксированными датами:
  иначе через неделю после написания мока «Обзор» показывал бы просроченные
  триалы вместо тех, с кем ещё можно связаться.
*/
const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 60 * 60_000).toISOString()

const BASE: Client[] = [
  { id: '1', name: 'Магнум Экспресс', city: 'Алматы', status: 'active', plan: 'Growth', employees: 34, lastActiveAt: minutesAgo(12), createdAt: '2026-02-14' },
  { id: '2', name: 'Продукты у дома №4', city: 'Караганда', status: 'trial', plan: 'Starter', employees: 6, lastActiveAt: minutesAgo(60), createdAt: '2026-08-02', trialEndsAt: daysFromNow(4) },
  { id: '3', name: 'Светофор Тараз', city: 'Тараз', status: 'active', plan: 'Growth', employees: 51, lastActiveAt: minutesAgo(27), createdAt: '2025-11-19' },
  { id: '4', name: 'Айсберг Маркет', city: 'Астана', status: 'paused', plan: 'Starter', employees: 12, lastActiveAt: minutesAgo(60 * 24 * 9), createdAt: '2026-05-07' },
  { id: '5', name: 'Береке Супермаркет', city: 'Шымкент', status: 'active', plan: 'Enterprise', employees: 88, lastActiveAt: minutesAgo(3), createdAt: '2026-01-23' },
  { id: '6', name: 'Дастархан', city: 'Актобе', status: 'trial', plan: 'Starter', employees: 4, lastActiveAt: minutesAgo(60 * 26), createdAt: '2026-08-05', trialEndsAt: daysFromNow(2) },
  { id: '7', name: 'Смак на Абая', city: 'Алматы', status: 'active', plan: 'Starter', employees: 19, lastActiveAt: minutesAgo(120), createdAt: '2026-03-30' },
  { id: '8', name: 'Гросс Опт', city: 'Павлодар', status: 'active', plan: 'Enterprise', employees: 126, lastActiveAt: minutesAgo(8), createdAt: '2025-09-11' },
  { id: '9', name: 'Ануар Фрукты', city: 'Кызылорда', status: 'paused', plan: 'Starter', employees: 8, lastActiveAt: minutesAgo(60 * 24 * 22), createdAt: '2026-06-16' },
  { id: '10', name: 'Небо Маркет', city: 'Усть-Каменогорск', status: 'active', plan: 'Growth', employees: 41, lastActiveAt: minutesAgo(44), createdAt: '2025-12-28' },
  { id: '11', name: 'Апельсин', city: 'Семей', status: 'trial', plan: 'Growth', employees: 11, lastActiveAt: minutesAgo(180), createdAt: '2026-07-29', trialEndsAt: daysFromNow(9) },
  { id: '12', name: 'Титан Ритейл', city: 'Атырау', status: 'active', plan: 'Growth', employees: 63, lastActiveAt: minutesAgo(5), createdAt: '2025-10-04' },
  { id: '13', name: 'Куаныш Маркет', city: 'Костанай', status: 'active', plan: 'Starter', employees: 22, lastActiveAt: minutesAgo(60), createdAt: '2026-04-21' },
  { id: '14', name: 'Наурыз Продукты', city: 'Уральск', status: 'paused', plan: 'Starter', employees: 15, lastActiveAt: minutesAgo(60 * 24 * 33), createdAt: '2026-02-13' },
  { id: '15', name: 'Восточный Базар', city: 'Туркестан', status: 'active', plan: 'Growth', employees: 37, lastActiveAt: minutesAgo(18), createdAt: '2026-06-09' },
  { id: '16', name: 'Родник', city: 'Актау', status: 'trial', plan: 'Starter', employees: 9, lastActiveAt: minutesAgo(60 * 24), createdAt: '2026-07-31', trialEndsAt: daysFromNow(1) },
]

const OWNERS = [
  'Ержан Сапаров',
  'Динара Абенова',
  'Марат Жумабеков',
  'Асель Нурланова',
  'Тимур Оспанов',
  'Гульмира Ахметова',
  'Санжар Калиев',
  'Алия Досжанова',
]

const STREETS = [
  'ул. Байтурсынова 41',
  'пр. Абая 112',
  'ул. Сейфуллина 8',
  'мкр. Самал-2, 33',
  'ул. Толе би 275',
  'пр. Назарбаева 19',
  'ул. Кунаева 54',
  'ул. Жамбыла 7',
]

const SLUGS = [
  'magnum', 'prodmarket', 'svetofor', 'aisberg', 'bereke', 'dastarkhan', 'smak', 'gross',
  'anuar', 'nebo', 'apelsin', 'titan', 'kuanysh', 'nauryz', 'bazar', 'rodnik',
]

/** Детали дописываются к базовой записи детерминированно — на демо этого хватает. */
function detailOf(client: Client): ClientDetail {
  const index = Number(client.id) - 1
  const owner = OWNERS[index % OWNERS.length]
  const slug = SLUGS[index] ?? 'client'
  const initial = owner.split(' ')[0][0].toLowerCase()
  const surname = owner.split(' ')[1].toLowerCase()

  return {
    ...client,
    address: `${client.city}, ${STREETS[index % STREETS.length]}`,
    ownerName: owner,
    phone: `+7 70${index % 8} ${200 + index} ${10 + index} ${30 + index}`,
    email: `${initial}.${translit(surname)}@${slug}.kz`,
    openTickets: 0,
    suspendedReason: client.status === 'paused' ? 'Просрочка оплаты' : undefined,
  }
}

/** Грубая транслитерация фамилии для демо-почты; в проде email приходит с бэкенда. */
function translit(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya',
    ъ: '', ь: '',
  }
  return [...value].map((char) => map[char] ?? char).join('')
}

const clients = new Map<string, ClientDetail>(
  BASE.map((client) => [client.id, detailOf(client)]),
)

// Клиент из мокапа — единственный с наполненной перепиской и журналом.
// На остальных проверяются пустые состояния обеих вкладок.
const SHOWCASE_ID = '5'

const showcase = clients.get(SHOWCASE_ID)
if (showcase) {
  showcase.address = 'Шымкент, ул. Байтурсынова 41'
  showcase.ownerName = 'Ержан Сапаров'
  showcase.phone = '+7 701 244 18 03'
  showcase.email = 'e.saparov@bereke.kz'
  showcase.openTickets = 2
}

const tickets = new Map<string, Ticket[]>([
  [
    SHOWCASE_ID,
    [
      {
        id: 't1',
        clientId: SHOWCASE_ID,
        subject: 'Не приходит код подтверждения на почту',
        status: 'in_progress',
        assignee: 'Айдар К.',
        lastMessageAt: '2026-08-14T11:02:00',
        messages: [
          { id: 'm1', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-13T17:20:00', text: 'Добрый день. Завели нового администратора смены, а код на почту не приходит. Проверяли спам, пусто.' },
          { id: 'm2', author: 'team', authorName: 'Айдар К.', sentAt: '2026-08-14T09:05:00', text: 'Здравствуйте. Отправили код повторно на e.saparov@bereke.kz. Проверьте, пожалуйста, и скажите, дошло ли.' },
          { id: 'm3', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-14T10:41:00', text: 'Пришло, спасибо. Но у второго сотрудника та же проблема, почта на mail.ru.' },
          { id: 'm4', author: 'team', authorName: 'Айдар К.', sentAt: '2026-08-14T11:02:00', text: 'Понял, проверяем доставку на mail.ru. Ответим сегодня до конца дня.' },
        ],
      },
      {
        id: 't2',
        clientId: SHOWCASE_ID,
        subject: 'Добавить сотрудника сверх лимита тарифа',
        status: 'open',
        assignee: null,
        lastMessageAt: '2026-08-13T12:14:00',
        messages: [
          { id: 'm5', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-13T12:14:00', text: 'Нужно добавить ещё 4 сотрудника, но система не даёт. Можно расширить лимит?' },
        ],
      },
      {
        id: 't3',
        clientId: SHOWCASE_ID,
        subject: 'Ошибка при входе оператора смены',
        status: 'resolved',
        assignee: 'Динара Т.',
        lastMessageAt: '2026-08-07T07:55:00',
        messages: [
          { id: 'm6', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-06T08:30:00', text: 'Оператор не может войти, пишет, что сессия истекла.' },
          { id: 'm7', author: 'team', authorName: 'Динара Т.', sentAt: '2026-08-06T09:12:00', text: 'Сессия истекает через 15 минут без активности — попросите войти снова. Если повторится, напишите точное время.' },
          { id: 'm8', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-07T07:55:00', text: 'Всё работает, больше не повторялось.' },
        ],
      },
      {
        id: 't4',
        clientId: SHOWCASE_ID,
        subject: 'Перенос данных из старой системы',
        status: 'closed',
        assignee: 'Айдар К.',
        lastMessageAt: '2026-06-12T11:40:00',
        messages: [
          { id: 'm9', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-06-10T15:02:00', text: 'Можно перенести список сотрудников из нашей прошлой программы?' },
          { id: 'm10', author: 'team', authorName: 'Айдар К.', sentAt: '2026-06-12T11:40:00', text: 'Перенесли 82 сотрудника, проверьте список в своей системе.' },
        ],
      },
    ],
  ],
])

const journal = new Map<string, JournalEntry[]>([
  [
    SHOWCASE_ID,
    [
      { id: 'j1', occurredAt: '2026-08-14T10:12:00', text: 'Айдар К. сгенерировал новый код подтверждения' },
      { id: 'j2', occurredAt: '2026-07-02T16:40:00', text: 'Динара Т. сменила тариф с Growth на Enterprise' },
      { id: 'j3', occurredAt: '2026-05-19T09:05:00', text: 'Айдар К. возобновил доступ' },
      { id: 'j4', occurredAt: '2026-05-17T18:22:00', text: 'Айдар К. приостановил доступ, причина: просрочка оплаты' },
      { id: 'j5', occurredAt: '2026-01-23T12:00:00', text: 'Динара Т. создала клиента' },
    ],
  ],
])

/** Кто «делает» действие в демо — в проде имя берётся из текущей сессии. */
const CURRENT_USER = 'Айдар К.'

/**
 * Открытые обращения по всем клиентам. Приедут из раздела поддержки
 * (`GET /api/v1/tickets`, ещё не реализован) — пока это то же демо-число,
 * что и бейдж в сайдбаре.
 */
export const OPEN_TICKETS = 7

/** Id новых клиентов не переиспользуются после удаления — как и в БД. */
let nextId = BASE.length + 1

function addJournalEntry(clientId: string, text: string): void {
  const entries = journal.get(clientId) ?? []
  entries.unshift({ id: `j${Date.now()}`, occurredAt: new Date().toISOString(), text })
  journal.set(clientId, entries)
}

/*
  Читающие методы отдают копии, а не записи стора.

  Это не перестраховка: React Query сравнивает предыдущие данные с новыми и,
  получив ту же самую ссылку, считает, что ничего не изменилось, и не
  перерисовывает экран — мутация проходит, а интерфейс остаётся прежним.
  Настоящий HTTP-ответ каждый раз даёт новые объекты; мок обязан вести себя
  так же, иначе на нём не проверить ни инвалидацию, ни перерисовку.
*/
export const mockStore = {
  listClients(): Client[] {
    return [...clients.values()].map((client) => ({ ...client }))
  },

  getClient(id: string): ClientDetail | undefined {
    const client = clients.get(id)
    return client && { ...client }
  },

  listTickets(clientId: string): Ticket[] {
    return (tickets.get(clientId) ?? []).map((ticket) => ({ ...ticket }))
  },

  listJournal(clientId: string): JournalEntry[] {
    return (journal.get(clientId) ?? []).map((entry) => ({ ...entry }))
  },

  isEmailTaken(email: string): boolean {
    const needle = email.trim().toLowerCase()
    return [...clients.values()].some((client) => client.email.toLowerCase() === needle)
  },

  create(input: NewClient): ClientDetail {
    const now = new Date()
    const trial = input.trialDays > 0
    const client: ClientDetail = {
      id: String(nextId++),
      name: input.name,
      // Город для колонки списка — то, что стоит до первой запятой: форма
      // принимает адрес одной строкой (см. NewClient). В проде это делает
      // бэкенд, здесь повторяем то же правило.
      city: input.address.split(',')[0].trim(),
      address: input.address,
      status: trial ? 'trial' : 'active',
      plan: input.plan,
      employees: 0,
      // Клиент ещё не входил: до первого входа показываем момент создания.
      lastActiveAt: now.toISOString(),
      createdAt: now.toISOString(),
      trialEndsAt: trial
        ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60_000).toISOString()
        : undefined,
      ownerName: input.ownerName,
      phone: input.phone,
      email: input.email,
      openTickets: 0,
      activationCode: {
        code: randomCode(),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
      },
    }
    clients.set(client.id, client)
    addJournalEntry(
      client.id,
      trial
        ? `${CURRENT_USER} создал клиента, пробный период ${input.trialDays} дн.`
        : `${CURRENT_USER} создал клиента без пробного периода`,
    )
    return { ...client }
  },

  suspend(id: string, reason: string): ClientDetail | undefined {
    const client = clients.get(id)
    if (!client) return undefined
    client.status = 'paused'
    client.suspendedReason = reason
    addJournalEntry(id, `${CURRENT_USER} приостановил доступ, причина: ${reason.toLowerCase()}`)
    return { ...client }
  },

  resume(id: string): ClientDetail | undefined {
    const client = clients.get(id)
    if (!client) return undefined
    client.status = 'active'
    client.suspendedReason = undefined
    addJournalEntry(id, `${CURRENT_USER} возобновил доступ`)
    return { ...client }
  },

  issueActivationCode(id: string): ClientDetail | undefined {
    const client = clients.get(id)
    if (!client) return undefined
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
    client.activationCode = { code: randomCode(), expiresAt }
    addJournalEntry(id, `${CURRENT_USER} сгенерировал новый код подтверждения`)
    return { ...client }
  },

  remove(id: string): void {
    clients.delete(id)
    tickets.delete(id)
    journal.delete(id)
  },
}

/** Код диктуют по телефону: без похожих друг на друга 0/O и 1/I. */
function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `${pick()}-${pick()}`
}
