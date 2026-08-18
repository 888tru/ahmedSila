import { request, USE_MOCK } from '@/lib/http'
import { mockSettingsStore } from './mock'
import type { MessageTemplateSettings, Settings } from './types'

export async function fetchSettings(signal?: AbortSignal): Promise<Settings> {
  if (USE_MOCK) return mockSettingsStore.get()
  return request<Settings>('/settings', { signal })
}

export async function saveMessageTemplate(text: string): Promise<MessageTemplateSettings> {
  if (USE_MOCK) return mockSettingsStore.saveTemplate(text)
  return request<MessageTemplateSettings>('/settings/message-template', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}
