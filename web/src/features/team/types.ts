/*
  «Команда» (PAGES.md §7) — сотрудники суперадминки и их роли. Не путать с
  клиентами (магазинами): это внутренний доступ команды к самой панели.
*/

import type { Tone } from '@/components/ui/tone'

export type TeamRole = 'owner' | 'admin' | 'support' | 'viewer'

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  support: 'Поддержка',
  viewer: 'Наблюдатель',
}

export const ROLE_HINT: Record<TeamRole, string> = {
  owner: 'Полный доступ, включая управление командой и удаление клиентов. Роль владельца изменить нельзя.',
  admin: 'Всё, кроме управления владельцем: клиенты, тарифы, приостановка доступа, обращения.',
  support: 'Обращения и просмотр клиентов. Не может менять тарифы и приостанавливать доступ.',
  viewer: 'Только просмотр: клиенты, обращения, журнал действий. Ничего не меняет.',
}

export const ROLE_TONE: Record<TeamRole, Tone> = {
  owner: 'accent',
  admin: 'accent',
  support: 'warn',
  viewer: 'muted',
}

/** Роли, доступные при приглашении — владельца не приглашают, он один. */
export const INVITABLE_ROLES: readonly TeamRole[] = ['admin', 'support', 'viewer']

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  twoFactorEnabled: boolean
  /** `null` — ещё ни разу не входил (принял приглашение, но не заходил). */
  lastLoginAt: string | null
  /** Текущий пользователь сессии — у него в строке пометка «это вы». */
  isMe: boolean
}
