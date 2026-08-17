import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export const FIELD_BASE =
  'w-full rounded-control border border-line bg-surface px-2.5 text-small text-ink outline-none ' +
  'transition-colors duration-100 placeholder:text-ink-muted focus:border-accent'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Подсветить границу красным — поле не прошло проверку. */
  invalid?: boolean
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, 'h-[30px]', invalid && 'border-danger', className)}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(FIELD_BASE, 'resize-y py-[9px] leading-normal', className)} {...props} />
  )
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD_BASE, 'h-[26px] px-1.5', className)} {...props} />
}
