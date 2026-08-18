import { request, USE_MOCK } from '@/lib/http'
import { DEFAULT_TEMPLATE, mockSettingsStore } from './mock'
import type { MessageTemplateSettings, PlanDetail, Settings } from './types'

interface PlanWire {
  plan: PlanDetail['key']
  limit: string
  price: string
  includes: string
}

interface TemplateWire {
  text: string
  updated_at: string | null
}

interface SettingsWire {
  plans: PlanWire[]
  template: TemplateWire
}

function toPlanDetail(p: PlanWire): PlanDetail {
  return { key: p.plan, limit: p.limit, price: p.price, includes: p.includes }
}

function toTemplateSettings(t: TemplateWire): MessageTemplateSettings {
  return { text: t.text, defaultText: DEFAULT_TEMPLATE, updatedAt: t.updated_at }
}

export async function fetchSettings(signal?: AbortSignal): Promise<Settings> {
  if (USE_MOCK) return mockSettingsStore.get()
  const wire = await request<SettingsWire>('/settings', { signal })
  return { plans: wire.plans.map(toPlanDetail), template: toTemplateSettings(wire.template) }
}

export async function saveMessageTemplate(text: string): Promise<MessageTemplateSettings> {
  if (USE_MOCK) return mockSettingsStore.saveTemplate(text)
  const wire = await request<TemplateWire>('/settings/message-template', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return toTemplateSettings(wire)
}
