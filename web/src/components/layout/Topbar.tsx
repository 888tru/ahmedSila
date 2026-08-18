import { Fragment } from 'react'
import { Link } from 'react-router'

import { Input } from '@/components/ui/Field'

export interface Crumb {
  label: string
  /** Без ссылки — текущее место или раздел без своего экрана. */
  to?: string
}

export interface TopbarSearch {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

interface TopbarProps {
  /** Хлебные крошки от корня; последний элемент — текущая страница. */
  breadcrumbs: readonly Crumb[]
  /** Поиск есть не на всех экранах — на карточке клиента искать нечего. */
  search?: TopbarSearch
  /** `null` — данные пользователя ещё не пришли (между restoreSession и /me). */
  user: { initials: string; name: string } | null
  onLogout: () => void
}

export function Topbar({ breadcrumbs, search, user, onLogout }: TopbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
      <nav
        aria-label="Хлебные крошки"
        className="flex min-w-0 items-center gap-[7px] text-tiny text-ink-muted"
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1
          return (
            <Fragment key={crumb.label}>
              {index > 0 && (
                <span aria-hidden className="opacity-50">
                  /
                </span>
              )}
              {crumb.to && !isLast ? (
                <Link to={crumb.to} className="truncate text-accent hover:text-accent-hover">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'truncate text-ink' : 'truncate'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </Fragment>
          )
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {search && (
          <Input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="w-[220px] bg-canvas focus:bg-surface"
          />
        )}
        {user && (
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-[26px] items-center justify-center rounded-full border border-line
                         bg-line-soft text-micro font-medium text-ink-muted"
            >
              {user.initials}
            </span>
            <span className="text-tiny text-ink-muted">{user.name}</span>
            <button
              type="button"
              onClick={onLogout}
              className="text-tiny text-ink-muted transition-colors duration-100 hover:text-ink"
            >
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
