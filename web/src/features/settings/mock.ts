import type { PlanDetail, Settings } from './types'

/*
  Демо-данные и мутирующий стор в памяти для шаблона сообщения — тот же приём,
  что в `features/clients/mock.ts`. Тарифные планы мутаций не имеют: это
  справочная таблица, редактируется вместе с бизнес-условиями, а не отсюда.

  Существует, пока в бэкенде нет ручек по настройкам (см. CLAUDE.md, «Состояние»).
*/

const PLANS: readonly PlanDetail[] = [
  { key: 'Starter', limit: 'до 15', price: '24 000', includes: 'Базовые задачи и смены, до 15 сотрудников, поддержка по email' },
  { key: 'Growth', limit: 'до 60', price: '58 000', includes: 'Задачи и смены, заявки на закупку, приоритетная поддержка' },
  { key: 'Enterprise', limit: 'без лимита', price: 'по договору', includes: 'Без ограничения по сотрудникам, отдельный менеджер, индивидуальные условия' },
]

// Экспортируется: то же значение возвращает бэкенд (см. migrations/0002 —
// сидовая строка `message_templates`), api.ts берёт его как `defaultText`
// для «Вернуть исходный текст», раз бэкенд не отдаёт значение по умолчанию
// на каждый ответ (см. api.ts).
export const DEFAULT_TEMPLATE =
  'Здравствуйте, {владелец}!\n\n' +
  'Доступ для магазина «{клиент}» открыт. Код подтверждения для первого входа: {код}\n\n' +
  'Код одноразовый и действует до {срок}. Введите его при первом входе — после этого вы зададите пароль и будете входить обычным способом.\n\n' +
  'Если код не сработал или срок истёк, ответьте на это сообщение — пришлём новый.'

let templateText = DEFAULT_TEMPLATE
let templateUpdatedAt: string | null = null

export const mockSettingsStore = {
  get(): Settings {
    return {
      plans: PLANS,
      template: { text: templateText, defaultText: DEFAULT_TEMPLATE, updatedAt: templateUpdatedAt },
    }
  },

  saveTemplate(text: string): Settings['template'] {
    templateText = text
    templateUpdatedAt = new Date().toISOString()
    return { text: templateText, defaultText: DEFAULT_TEMPLATE, updatedAt: templateUpdatedAt }
  },
}
