import { Metrics } from '@/components/ui/Metrics'
import { OPEN_TICKETS } from './mock'
import type { StatusCounts } from './useClients'

interface ClientsMetricsProps {
  counts: StatusCounts
  loading: boolean
}

/**
 * Показатели над таблицей клиентов. Дельт здесь нет: это контекст к списку,
 * который пользователь и так видит целиком, — сравнение с прошлым периодом
 * живёт на «Обзоре».
 */
export function ClientsMetrics({ counts, loading }: ClientsMetricsProps) {
  return (
    <Metrics
      loading={loading}
      cells={[
        { label: 'Активных клиентов', value: counts.active },
        { label: 'На триале', value: counts.trial },
        { label: 'На паузе', value: counts.paused },
        { label: 'Открытых обращений', value: OPEN_TICKETS },
      ]}
    />
  )
}
