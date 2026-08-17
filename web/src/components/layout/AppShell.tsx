import { useState, type ReactNode } from 'react'

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

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar
        active={active}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          breadcrumbs={breadcrumbs}
          search={search}
          user={{ initials: 'АК', name: 'Айдар К.' }}
        />
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
