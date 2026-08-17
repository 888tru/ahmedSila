import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'danger' | 'destructive'
type Size = 'xs' | 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'text-white bg-accent border-accent hover:bg-accent-hover disabled:opacity-45',
  secondary:
    'text-ink bg-surface border-line hover:border-accent hover:text-accent ' +
    'disabled:bg-canvas disabled:text-ink-muted',
  // Приглушённая до наведения — для действий в строке таблицы
  danger: 'text-ink-muted bg-surface border-line hover:border-danger hover:text-danger',
  // Всегда читается как опасное: красный текст и мягкая красная граница
  destructive:
    'text-danger bg-surface border-danger-line hover:border-danger ' +
    'disabled:border-line disabled:text-ink-muted',
}

const SIZES: Record<Size, string> = {
  xs: 'h-6 px-2 text-mini rounded-[4px]',
  sm: 'h-[30px] px-[13px] text-small rounded-control',
  md: 'h-8 px-[14px] text-body rounded-control',
}

interface Appearance {
  variant?: Variant
  size?: Size
  className?: string
}

function appearance({ variant = 'secondary', size = 'md', className }: Appearance): string {
  return cn(
    // 100мс — потолок анимации по брифу, ничего сложнее смены цвета
    'inline-flex items-center justify-center gap-1.5 border font-medium',
    'transition-colors duration-100 disabled:cursor-default disabled:hover:border-line',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Appearance {}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={appearance({ variant, size, className })} {...props} />
}

interface LinkButtonProps extends LinkProps, Appearance {}

/**
 * Кнопка, которая на самом деле переход. Нужна везде, где действие ведёт на
 * другой экран: ссылку можно открыть в новой вкладке и скопировать, кнопка с
 * `navigate()` — нет.
 */
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={appearance({ variant, size, className })} {...props} />
}
