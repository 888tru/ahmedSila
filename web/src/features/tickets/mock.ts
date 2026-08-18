import type { GlobalTicketDetail } from './types'

/*
  Демо-данные «Обращений». Существуют, пока в бэкенде нет общей ручки по
  обращениям (см. CLAUDE.md, «Состояние» — там пока только `/clients/:id/tickets`
  на одного клиента). `clientId` указывает на реальные записи в
  `features/clients/mock.ts`, чтобы ссылка на клиента из строки таблицы вела
  в настоящую карточку, а не в никуда.

  В отличие от стора клиентов, здесь нет мутаций: назначение на себя и отметка
  «решено» в макете не привязаны к данным (see Обращения.dc.html, `onClick:
  noop`) — они появятся вместе с `POST /api/v1/tickets/:id`.
*/

export const TICKETS: readonly GlobalTicketDetail[] = [
  {
    id: 't-1',
    clientId: '5',
    clientName: 'Береке Супермаркет',
    city: 'Шымкент',
    subject: 'Не приходит код подтверждения на почту',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Айдар К.',
    contactName: 'Ержан Сапаров',
    lastMessageAt: '2026-08-14T11:02:00',
    messages: [
      { id: 't1-m1', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-13T17:20:00', text: 'Добрый день. Завели нового администратора смены, а код на почту не приходит. Проверяли спам, пусто.' },
      { id: 't1-m2', author: 'team', authorName: 'Айдар К.', sentAt: '2026-08-14T09:05:00', text: 'Здравствуйте. Отправили код повторно. Проверьте, пожалуйста, и скажите, дошло ли.' },
      { id: 't1-m3', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-08-14T10:41:00', text: 'Пришло, спасибо. Но у второго сотрудника та же проблема, почта на mail.ru.' },
      { id: 't1-m4', author: 'team', authorName: 'Айдар К.', sentAt: '2026-08-14T11:02:00', text: 'Понял, проверяем доставку на mail.ru. Ответим сегодня до конца дня.' },
    ],
  },
  {
    id: 't-2',
    clientId: '7',
    clientName: 'Смак на Абая',
    city: 'Алматы',
    subject: 'Добавить сотрудника сверх лимита тарифа',
    status: 'open',
    priority: 'normal',
    assignee: null,
    contactName: 'Асель Нурланова',
    lastMessageAt: '2026-08-13T18:05:00',
    messages: [
      { id: 't2-m1', author: 'client', authorName: 'Асель Нурланова', sentAt: '2026-08-13T18:05:00', text: 'Нужно добавить ещё 4 сотрудника, но система не даёт. Можно расширить лимит?' },
    ],
  },
  {
    id: 't-3',
    clientId: '1',
    clientName: 'Магнум Экспресс',
    city: 'Алматы',
    subject: 'Оператор не видит заявки после смены',
    status: 'open',
    priority: 'high',
    assignee: null,
    contactName: 'Дамир Ералиев',
    lastMessageAt: '2026-08-13T14:30:00',
    messages: [
      { id: 't3-m1', author: 'client', authorName: 'Дамир Ералиев', sentAt: '2026-08-13T14:30:00', text: 'После пересдачи смены заявки пропадают из списка у оператора. Скриншот приложим.' },
    ],
  },
  {
    id: 't-4',
    clientId: '8',
    clientName: 'Гросс Опт',
    city: 'Павлодар',
    subject: 'Просим перенести дату списания',
    status: 'in_progress',
    priority: 'normal',
    assignee: 'Динара Т.',
    contactName: 'Ольга Ким',
    lastMessageAt: '2026-08-12T09:40:00',
    messages: [
      { id: 't4-m1', author: 'client', authorName: 'Ольга Ким', sentAt: '2026-08-11T10:15:00', text: 'Можно перенести списание на 20 число? Бюджет закрывается позже.' },
      { id: 't4-m2', author: 'team', authorName: 'Динара Т.', sentAt: '2026-08-12T09:40:00', text: 'Передали в биллинг, до конца недели подтвердим дату.' },
    ],
  },
  {
    id: 't-5',
    clientId: '4',
    clientName: 'Айсберг Маркет',
    city: 'Астана',
    subject: 'Восстановить доступ после приостановки',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Айдар К.',
    contactName: 'Тимур Абдиров',
    lastMessageAt: '2026-08-12T11:05:00',
    messages: [
      { id: 't5-m1', author: 'client', authorName: 'Тимур Абдиров', sentAt: '2026-08-12T08:20:00', text: 'Оплату провели вчера, доступ всё ещё закрыт.' },
      { id: 't5-m2', author: 'team', authorName: 'Айдар К.', sentAt: '2026-08-12T11:05:00', text: 'Видим платёж, возобновим доступ в течение часа.' },
    ],
  },
  {
    id: 't-6',
    clientId: '10',
    clientName: 'Небо Маркет',
    city: 'Усть-Каменогорск',
    subject: 'Ошибка при входе оператора смены',
    status: 'resolved',
    priority: 'normal',
    assignee: 'Динара Т.',
    contactName: 'Марат Жунусов',
    lastMessageAt: '2026-08-07T07:55:00',
    messages: [
      { id: 't6-m1', author: 'client', authorName: 'Марат Жунусов', sentAt: '2026-08-06T08:30:00', text: 'Оператор не может войти, пишет, что сессия истекла.' },
      { id: 't6-m2', author: 'team', authorName: 'Динара Т.', sentAt: '2026-08-06T09:12:00', text: 'Сессия истекает через 15 минут без активности — попросите войти снова. Если повторится, напишите точное время.' },
      { id: 't6-m3', author: 'client', authorName: 'Марат Жунусов', sentAt: '2026-08-07T07:55:00', text: 'Всё работает, больше не повторялось.' },
    ],
  },
  {
    id: 't-7',
    clientId: '12',
    clientName: 'Титан Ритейл',
    city: 'Атырау',
    subject: 'Как поменять владельца аккаунта',
    status: 'resolved',
    priority: 'low',
    assignee: 'Сауле М.',
    contactName: 'Ирина Пак',
    lastMessageAt: '2026-08-04T13:02:00',
    messages: [
      { id: 't7-m1', author: 'client', authorName: 'Ирина Пак', sentAt: '2026-08-04T12:10:00', text: 'Владелец сменился, как переоформить учётку?' },
      { id: 't7-m2', author: 'team', authorName: 'Сауле М.', sentAt: '2026-08-04T13:02:00', text: 'Пришлите новые ФИО и телефон — поменяем на нашей стороне.' },
    ],
  },
  {
    id: 't-8',
    clientId: '5',
    clientName: 'Береке Супермаркет',
    city: 'Шымкент',
    subject: 'Перенос данных из старой системы',
    status: 'closed',
    priority: 'low',
    assignee: 'Айдар К.',
    contactName: 'Ержан Сапаров',
    lastMessageAt: '2026-06-12T11:40:00',
    messages: [
      { id: 't8-m1', author: 'client', authorName: 'Ержан Сапаров', sentAt: '2026-06-10T15:02:00', text: 'Можно перенести список сотрудников из нашей прошлой программы?' },
      { id: 't8-m2', author: 'team', authorName: 'Айдар К.', sentAt: '2026-06-12T11:40:00', text: 'Перенесли 82 сотрудника, проверьте список в своей системе.' },
    ],
  },
]

export function listTickets(): GlobalTicketDetail[] {
  return TICKETS.map((ticket) => ({ ...ticket, messages: ticket.messages.map((m) => ({ ...m })) }))
}

export function getTicket(id: string): GlobalTicketDetail | undefined {
  const ticket = TICKETS.find((t) => t.id === id)
  return ticket && { ...ticket, messages: ticket.messages.map((m) => ({ ...m })) }
}
