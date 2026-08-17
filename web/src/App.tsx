import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { ClientPage } from '@/features/clients/ClientPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { NewClientPage } from '@/features/clients/NewClientPage'
import { OverviewPage } from '@/features/overview/OverviewPage'
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
  Из восьми экранов PAGES.md реализовано пять: обзор (§1), список клиентов
  (§2), карточка клиента (§3), создание клиента (§4) и обращения (§5). Вкладка
  карточки —
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
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
