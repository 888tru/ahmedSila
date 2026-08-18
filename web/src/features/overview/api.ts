import { request, USE_MOCK } from '@/lib/http'
import { buildOverview } from './mock'
import type { Overview, OverviewEventKind, OverviewMetricKey } from './types'

interface OverviewWire {
  period_days: number
  total_clients: number
  metrics: Array<{ key: OverviewMetricKey; value: number; delta: number | null }>
  expiring_trials: Array<{ client_id: string; name: string; ends_at: string }>
  events: Array<{ id: number; occurred_at: string; kind: OverviewEventKind; text: string }>
}

function fromWire(w: OverviewWire): Overview {
  return {
    periodDays: w.period_days,
    totalClients: w.total_clients,
    metrics: w.metrics,
    expiringTrials: w.expiring_trials.map((t) => ({ clientId: t.client_id, name: t.name, endsAt: t.ends_at })),
    events: w.events.map((e) => ({ id: String(e.id), occurredAt: e.occurred_at, kind: e.kind, text: e.text })),
  }
}

/**
 * Весь «Обзор» — один ответ: показатели, ближайшие окончания триалов и лента
 * событий считаются на бэкенде за один проход. Три отдельных запроса дали бы
 * три разных момента времени в одной шапке «обновлено в …».
 */
export async function fetchOverview(signal?: AbortSignal): Promise<Overview> {
  if (USE_MOCK) return buildOverview()
  const wire = await request<OverviewWire>('/overview', { signal })
  return fromWire(wire)
}
