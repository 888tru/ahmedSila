import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface PanelProps {
  title?: string
  /** Приглушённое уточнение сразу за заголовком: «за 30 дней», «Только просмотр». */
  hint?: string
  /** Управление, прижатое к правому краю шапки. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Карточка-раздел: белая поверхность, hairline-граница, шапка 38px. */
export function Panel({ title, hint, action, children, className }: PanelProps) {
  return (
    <section className={cn('overflow-hidden rounded-panel border border-line bg-surface', className)}>
      {(title || action) && (
        <div className="flex h-[38px] items-center gap-2.5 border-b border-line px-[15px]">
          {title && <h2 className="text-body font-medium">{title}</h2>}
          {hint && <span className="text-mini text-ink-muted">{hint}</span>}
          {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export interface Definition {
  label: string
  value: ReactNode
}

/**
 * Пары «подпись — значение» (контакты, подписка). Колонка подписи фиксированной
 * ширины, чтобы значения выстраивались в одну вертикаль между карточками.
 */
export function DefinitionList({
  items,
  labelWidth = '104px',
}: {
  items: readonly Definition[]
  labelWidth?: string
}) {
  return (
    <dl
      className="grid text-small"
      style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr)` }}
    >
      {items.map((item, index) => {
        const border = index < items.length - 1 ? 'border-b border-line-soft' : ''
        return (
          <div key={item.label} className="contents">
            <dt className={cn('py-[9px] pl-[15px] text-ink-muted', border)}>{item.label}</dt>
            <dd className={cn('min-w-0 py-[9px] pr-[15px]', border)}>{item.value}</dd>
          </div>
        )
      })}
    </dl>
  )
}
