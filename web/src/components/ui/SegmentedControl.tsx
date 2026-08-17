import { cn } from '@/lib/cn'

export interface Segment<T extends string | number> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string | number> {
  segments: ReadonlyArray<Segment<T>>
  value: T
  onChange: (value: T) => void
  /** Подпись группы для скринридера — визуально её заменяет текст слева. */
  label: string
  mono?: boolean
}

/** Переключатель из 2–3 взаимоисключающих значений: плотность, строк на странице. */
export function SegmentedControl<T extends string | number>({
  segments,
  value,
  onChange,
  label,
  mono = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex overflow-hidden rounded-control border border-line bg-surface"
    >
      {segments.map((segment, index) => (
        <button
          key={segment.value}
          type="button"
          aria-pressed={segment.value === value}
          onClick={() => onChange(segment.value)}
          className={cn(
            'h-[26px] px-2.5 text-tiny text-ink transition-colors duration-100',
            index > 0 && 'border-l border-line',
            mono && 'font-mono text-mini',
            segment.value === value ? 'bg-accent-soft' : 'bg-transparent hover:bg-canvas',
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
