import { cn } from '@/lib/cn'

export interface Choice<T extends string> {
  value: T
  label: string
}

interface ChoiceGroupProps<T extends string> {
  options: ReadonlyArray<Choice<T>>
  value: T
  onChange: (value: T) => void
  /** Подпись группы для скринридера — визуально её заменяет подпись строки формы. */
  label: string
}

/**
 * Взаимоисключающий выбор из нескольких равнозначных вариантов: тариф, статус
 * при создании. От `SegmentedControl` отличается назначением, а не разметкой:
 * сегменты переключают вид одних и тех же данных (плотность, размер страницы)
 * и живут в панелях управления, а это — поле формы, поэтому варианты подписаны
 * словами и помечены точкой, как статусы в таблице.
 *
 * Роль `radio` не берём намеренно: она обещает переключение стрелками и один
 * tab-stop на группу, а здесь, как и у сегментов, каждый вариант — обычная
 * кнопка в общем tab-порядке.
 */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: ChoiceGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-[30px] items-center gap-2 rounded-control border px-3',
              'text-small text-ink transition-colors duration-100',
              selected
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span
              aria-hidden
              className={cn('size-1.5 shrink-0 rounded-full', selected ? 'bg-accent' : 'bg-line')}
            />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
