import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router'

import {
  IconAudit,
  IconClients,
  IconCollapse,
  IconOverview,
  IconSettings,
  IconTeam,
  IconTickets,
} from './icons'
import { cn } from '@/lib/cn'

export type SectionKey = 'overview' | 'clients' | 'tickets' | 'audit' | 'team' | 'settings'

interface NavItem {
  key: SectionKey
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Маршрут; без него пункт нарисован, но неактивен — экрана ещё нет. */
  to?: string
  /** Счётчик справа от пункта — сейчас только у обращений. */
  badge?: number
}

interface SidebarProps {
  active: SectionKey
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Открытых обращений — счётчик у «Обращения», `undefined` пока не загружен. */
  openTicketsCount?: number
}

export function Sidebar({ active, collapsed, onToggleCollapsed, openTicketsCount }: SidebarProps) {
  const NAV: readonly NavItem[] = [
    { key: 'overview', label: 'Обзор', icon: IconOverview, to: '/overview' },
    { key: 'clients', label: 'Клиенты', icon: IconClients, to: '/clients' },
    { key: 'tickets', label: 'Обращения', icon: IconTickets, to: '/tickets', badge: openTicketsCount },
    { key: 'audit', label: 'Журнал действий', icon: IconAudit, to: '/journal' },
    { key: 'team', label: 'Команда', icon: IconTeam, to: '/team' },
    { key: 'settings', label: 'Настройки', icon: IconSettings, to: '/settings' },
  ]

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-line bg-surface py-3.5',
        'transition-[width] duration-100',
        collapsed ? 'w-[52px]' : 'w-[212px]',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-[9px] px-4 pt-0.5 pb-[18px]',
          collapsed && 'justify-center px-0',
        )}
      >
        <span aria-hidden className="size-5 shrink-0 rounded-[5px] border-[1.5px] border-accent" />
        {!collapsed && (
          <span className="text-body font-medium tracking-[-0.1px]">Суперадминка</span>
        )}
      </div>

      <nav className="flex flex-col gap-px px-2" aria-label="Разделы">
        {NAV.map((item) => {
          const isActive = item.key === active
          const Icon = item.icon
          const className = cn(
            'flex items-center gap-2.5 rounded-control px-2 py-[7px] text-body',
            'transition-colors duration-100',
            collapsed && 'justify-center px-0',
            isActive
              ? 'bg-accent-soft font-medium text-accent'
              : 'text-ink-muted hover:bg-canvas hover:text-ink',
            !item.to && !isActive && 'cursor-default hover:bg-transparent hover:text-ink-muted',
          )
          const content = (
            <>
              <Icon className={cn('size-3.5 shrink-0', !isActive && 'opacity-75')} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto font-mono text-micro text-ink-muted">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </>
          )

          if (!item.to) {
            // Экран ещё не реализован (PAGES.md §5–§8) — пункт виден,
            // чтобы не сдвигалось меню, но никуда не ведёт.
            return (
              <span
                key={item.key}
                aria-disabled
                title={collapsed ? item.label : undefined}
                className={className}
              >
                {content}
              </span>
            )
          }

          return (
            <Link
              key={item.key}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={className}
            >
              {content}
            </Link>
          )
        })}
      </nav>

      <div className={cn('mt-auto border-t border-line-soft px-4 pt-3.5', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className={cn(
            'flex items-center gap-2 text-tiny text-ink-muted transition-colors duration-100 hover:text-ink',
            collapsed && 'w-full justify-center',
          )}
        >
          <IconCollapse className={cn('size-3 shrink-0', collapsed && 'rotate-180')} />
          {!collapsed && 'Свернуть меню'}
        </button>
      </div>
    </aside>
  )
}
