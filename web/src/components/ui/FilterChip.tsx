import { DOT, type Tone } from './tone'
import { cn } from '@/lib/cn'

interface FilterChipProps {
  label: string
  /** Счётчик справа от подписи. Без него — простой чип без числа (фильтр по сотруднику). */
  count?: number
  selected: boolean
  onClick: () => void
  /** Цветная точка перед подписью — фильтр по статусу с несколькими тонами в одной группе. */
  tone?: Tone
}

/**
 * Чип-фильтр со счётчиком. Выбранное состояние — второй контур поверх первого
 * (inset:-1px), а не смена ширины границы: иначе при выборе чип «дёргается»
 * на пиксель и вся строка фильтров переливается.
 */
export function FilterChip({ label, count, selected, onClick, tone }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative flex h-7 items-center gap-[7px] rounded-control border border-line',
        'bg-surface px-[11px] text-small text-ink-muted transition-colors duration-100',
        selected ? 'text-ink' : 'hover:border-line-strong',
      )}
    >
      {tone && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} />}
      <span>{label}</span>
      {count !== undefined && <span className="font-mono text-micro opacity-70">{count}</span>}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-control border border-accent"
        />
      )}
    </button>
  )
}
