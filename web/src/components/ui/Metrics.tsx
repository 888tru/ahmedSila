import { Skeleton } from './States'
import { cn } from '@/lib/cn'
import { formatDelta, formatNumber } from '@/lib/format'

export interface Metric {
  label: string
  value: number
  /** Изменение к предыдущему периоду. `null` — сравнивать не с чем. */
  delta?: number | null
}

interface MetricsProps {
  cells: readonly Metric[]
  loading?: boolean
  /**
   * `lg` — «Обзор», где строка показателей и есть главный блок экрана.
   * По умолчанию `sm`: над таблицей клиентов она вспомогательная и набрана
   * мельче, чтобы не спорить с самой таблицей.
   */
  size?: 'sm' | 'lg'
}

/**
 * Узкая строка показателей: число + подпись. Не крупные глянцевые KPI-карточки
 * на весь экран — это верхнеуровневый контекст, а не витрина (DESIGN_BRIEF).
 */
export function Metrics({ cells, loading = false, size = 'sm' }: MetricsProps) {
  const large = size === 'lg'

  return (
    <div
      className="grid overflow-hidden rounded-panel border border-line bg-surface"
      style={{ gridTemplateColumns: `repeat(${cells.length},minmax(0,1fr))` }}
    >
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={cn(
            'flex flex-col',
            large ? 'gap-[3px] px-[15px] py-3' : 'gap-0.5 px-3.5 py-[11px]',
            index < cells.length - 1 && 'border-r border-line-soft',
          )}
        >
          {loading ? (
            <Skeleton className={cn('w-10', large ? 'my-1 h-4' : 'my-[3px] h-4')} />
          ) : (
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'font-mono leading-tight font-medium',
                  large ? 'text-metric-lg' : 'text-metric',
                )}
              >
                {formatNumber(cell.value)}
              </span>
              {cell.delta != null && (
                <span className="font-mono text-tiny text-ink-muted">
                  {formatDelta(cell.delta)}
                </span>
              )}
            </div>
          )}
          <span className="text-mini text-ink-muted">{cell.label}</span>
        </div>
      ))}
    </div>
  )
}
