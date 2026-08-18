import { useState, type ReactNode } from 'react'

import { logout } from '@/features/auth/api'
import { useAuth } from '@/features/auth/useAuth'
import { useTickets } from '@/features/tickets/useTickets'
import { Sidebar, type SectionKey } from './Sidebar'
import { Topbar, type Crumb, type TopbarSearch } from './Topbar'

interface AppShellProps {
  active: SectionKey
  breadcrumbs: readonly Crumb[]
  search?: TopbarSearch
  children: ReactNode
}

/*
  Оболочка: сайдбар слева, тонкий topbar сверху, скроллится только контент.
  Поиск живёт в topbar, но состояние принадлежит экрану — на разных разделах
  он ищет по разным сущностям, общего «глобального поиска» в MVP нет.
*/
export function AppShell({ active, breadcrumbs, search, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  // Тот же кэш, что у самого экрана «Обращения»: если он уже открыт где-то
  // рядом, второй запрос не уходит — react-query отдаёт то же значение.
  const tickets = useTickets()
  const openTicketsCount = tickets.data?.filter((ticket) => ticket.status === 'open').length

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar
        active={active}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        openTicketsCount={openTicketsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          breadcrumbs={breadcrumbs}
          search={search}
          user={user ? { initials: initialsOf(user.fullName), name: shortNameOf(user.fullName) } : null}
          onLogout={() => void logout()}
        />
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

/** «АК» из «Айдар Керимов» — по одной букве от первых двух слов имени. */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** «Айдар К.» из «Айдар Керимов» — имя целиком, фамилия инициалом. */
function shortNameOf(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/)
  const last = rest[0]
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}
