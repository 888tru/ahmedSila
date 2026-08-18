/*
  «Журнал действий» (PAGES.md §6) — то же самое, что вкладка «Журнал» в
  карточке клиента (`features/clients/tabs/ClientJournalTab.tsx`), но по всей
  команде сразу и с фильтрами: кто сделал, что за действие, за какой период.
*/

import type { Tone } from '@/components/ui/tone'

export type JournalActionKind = 'access' | 'clients' | 'subscription' | 'tickets' | 'team'

export const KIND_LABEL: Record<JournalActionKind, string> = {
  access: 'Доступ',
  clients: 'Клиенты',
  subscription: 'Подписка',
  tickets: 'Обращения',
  team: 'Команда',
}

export const KIND_ORDER: readonly JournalActionKind[] = [
  'access',
  'clients',
  'subscription',
  'tickets',
  'team',
]

export const KIND_TONE: Record<JournalActionKind, Tone> = {
  access: 'danger',
  clients: 'accent',
  subscription: 'warn',
  tickets: 'ok',
  team: 'muted',
}

export interface GlobalJournalEntry {
  id: string
  occurredAt: string
  actor: string
  kind: JournalActionKind
  text: string
  /** Действия по команде (приглашение, отзыв доступа) не привязаны к клиенту. */
  clientId: string | null
  clientName: string | null
}

export type JournalActorFilter = 'all' | string
export type JournalKindFilter = 'all' | JournalActionKind
export type JournalPeriod = '7' | '30' | 'custom'
