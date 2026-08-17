import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Склеивает классы, разрешая конфликты Tailwind в пользу последнего. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
