import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { ClientPage } from '@/features/clients/ClientPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { NewClientPage } from '@/features/clients/NewClientPage'
import { JournalPage } from '@/features/journal/JournalPage'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TeamPage } from '@/features/team/TeamPage'
import { TicketsPage } from '@/features/tickets/TicketsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Внутренняя панель: перезапрашивать список при каждом возврате на
      // вкладку — лишний шум, данные по клиентам меняются редко.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

/*
  Реализованы все восемь экранов PAGES.md: обзор (§1), список клиентов (§2),
  карточка клиента (§3), создание клиента (§4), обращения (§5), журнал
  действий (§6), команда (§7) и настройки (§8). Вкладка карточки —
  сегмент адреса, а не состояние компонента: ссылкой на конкретную вкладку
  конкретного клиента можно поделиться, и это главный способ передать клиента
  коллеге внутри команды.

  `/clients/new` объявлен раньше `/clients/:clientId` — иначе «new» попадёт в
  параметр и уедет запрос за несуществующим клиентом.

  Корень ведёт на «Обзор»: это стартовый экран после входа (PAGES.md §1).
*/
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/new" element={<NewClientPage />} />
          <Route path="/clients/:clientId" element={<ClientPage />} />
          <Route path="/clients/:clientId/:tab" element={<ClientPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
