import { Button } from './Button'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title: string
  hint: string
  ctaLabel: string
  onCta: () => void
}

/** Пустое состояние — приглашение к действию, не извинение (см. DESIGN_BRIEF). */
export function EmptyState({ title, hint, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-14">
      <span className="text-lead font-medium">{title}</span>
      <span className="max-w-[340px] text-center text-small text-ink-muted">{hint}</span>
      <Button variant="primary" size="sm" className="mt-0.5" onClick={onCta}>
        {ctaLabel}
      </Button>
    </div>
  )
}

/** Ошибка загрузки: что случилось и что делать, без слова «Ошибка» в начале. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-14">
      <span className="text-lead font-medium">Не удалось загрузить данные</span>
      <span className="max-w-[340px] text-center text-small text-ink-muted">
        Проверьте соединение и попробуйте снова.
      </span>
      <Button size="sm" className="mt-0.5" onClick={onRetry}>
        Повторить
      </Button>
    </div>
  )
}

/** Плейсхолдер в форме будущего контента — вместо спиннера на весь экран. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block rounded-[3px] bg-line-soft', className)} />
}
