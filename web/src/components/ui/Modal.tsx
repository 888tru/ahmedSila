import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  /**
   * Точка-статус слева от заголовка. Нужна модалкам-результатам («Клиент
   * создан»): они сообщают об уже случившемся, и точка отличает их от модалок
   * подтверждения, где заголовок — вопрос к пользователю.
   */
  tone?: 'ok'
  onClose: () => void
  /** Кнопки подвала; порядок как в макете — основное действие первым. */
  footer: ReactNode
  children: ReactNode
}

/**
 * Модалка для подтверждения необратимых действий. Закрывается по Escape и по
 * клику вне окна — оба выхода безопасны, потому что подтверждающее действие
 * всегда внутри и требует явного ввода.
 */
export function Modal({ title, tone, onClose, footer, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Фокус уводим внутрь окна, иначе Tab продолжит гулять по странице под ним
    cardRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,30,27,0.28)] p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal
        aria-label={title}
        className="w-[436px] max-w-full overflow-hidden rounded-panel border border-line bg-surface shadow-[0_8px_28px_rgba(31,30,27,0.14)]"
      >
        <div className="flex h-10 items-center gap-2.5 border-b border-line px-4">
          {tone && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ok" />}
          <h2 className="text-lead font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ml-auto flex size-6 items-center justify-center text-ink-muted transition-colors duration-100 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">{children}</div>
        <div className="flex gap-2 border-t border-line px-4 py-3">{footer}</div>
      </div>
    </div>
  )
}
