/*
  «Настройки» (PAGES.md §8): тарифные планы — справочно, редактируются при
  изменении бизнес-условий, не отсюда; шаблон сообщения с кодом подтверждения —
  редактируемый, уходит клиенту вместе с кодом (см. `ClientAccessTab`).
*/

import type { ClientPlan } from '@/features/clients/types'

export interface PlanDetail {
  key: ClientPlan
  /** Лимит сотрудников текстом: «до 15», «без лимита» — не всегда число. */
  limit: string
  /** Цена текстом: «по договору» у Enterprise — тоже не всегда число. */
  price: string
  includes: string
}

export interface MessageTemplateSettings {
  text: string
  /** Текст «из коробки» — на него возвращает кнопка «Вернуть исходный текст». */
  defaultText: string
  /** `null` — ещё ни разу не сохраняли. */
  updatedAt: string | null
}

export interface Settings {
  plans: readonly PlanDetail[]
  template: MessageTemplateSettings
}

/** Подстановки шаблона и их значения для предпросмотра. */
export const TEMPLATE_VARS = ['{владелец}', '{клиент}', '{код}', '{срок}'] as const

export const TEMPLATE_PREVIEW_SAMPLE: Record<(typeof TEMPLATE_VARS)[number], string> = {
  '{владелец}': 'Ержан',
  '{клиент}': 'Береке Супермаркет',
  '{код}': 'K7QF-3M2D',
  '{срок}': '21.08.2026',
}
