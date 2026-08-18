import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { replyToTicket, updateTicketStatus } from '@/features/tickets/api'
import {
  createClient,
  deleteClient,
  fetchClient,
  fetchClientJournal,
  fetchClientTickets,
  fetchClients,
  isEmailTaken,
  issueActivationCode,
  resumeClient,
  suspendClient,
} from './api'
import type { Client, ClientFilter, ClientStatus } from './types'

const keys = {
  all: ['clients'] as const,
  list: () => [...keys.all, 'list'] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
  tickets: (id: string) => [...keys.all, 'tickets', id] as const,
  journal: (id: string) => [...keys.all, 'journal', id] as const,
  emailTaken: (email: string) => [...keys.all, 'email-taken', email] as const,
}

export function useClients() {
  return useQuery({
    queryKey: keys.list(),
    queryFn: ({ signal }) => fetchClients(signal),
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: ({ signal }) => fetchClient(id, signal),
  })
}

export function useClientTickets(id: string) {
  return useQuery({
    queryKey: keys.tickets(id),
    queryFn: ({ signal }) => fetchClientTickets(id, signal),
  })
}

/*
  Ответ и отметка «решено» на вкладке карточки клиента ходят в те же ручки
  `/api/v1/tickets/:id/...`, что и общий раздел «Обращения» (см.
  `features/tickets/api.ts`) — это одна и та же сущность, здесь просто другой
  срез. Инвалидируют `keys.tickets(clientId)`, а не общий ключ `tickets`:
  экран, с которого ушёл запрос, должен обновиться первым.
*/
export function useReplyToClientTicket(clientId: string, ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => replyToTicket(ticketId, text),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.tickets(clientId) }),
  })
}

export function useMarkClientTicketResolved(clientId: string, ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => updateTicketStatus(ticketId, 'resolved'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.tickets(clientId) }),
  })
}

export function useClientJournal(id: string) {
  return useQuery({
    queryKey: keys.journal(id),
    queryFn: ({ signal }) => fetchClientJournal(id, signal),
  })
}

/**
 * Проверка занятости email в форме создания. Пустая строка выключает запрос —
 * так вызывающий не спрашивает про заведомо неполный адрес.
 *
 * Ответ по конкретному адресу не протухает: пока форму заполняют, второй раз
 * спрашивать про тот же email незачем — иначе каждое возвращение фокуса в поле
 * дёргало бы бэкенд.
 */
export function useEmailTaken(email: string) {
  return useQuery({
    queryKey: keys.emailTaken(email),
    queryFn: ({ signal }) => isEmailTaken(email, signal),
    enabled: email !== '',
    staleTime: Infinity,
  })
}

/**
 * Создание клиента. Ответ кладём в кэш карточки: сразу после модалки с кодом
 * пользователь уходит в карточку этого клиента, и она должна открыться с
 * данными, а не с пустым каркасом.
 */
export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClient,
    onSuccess: (client) => {
      queryClient.setQueryData(keys.detail(client.id), client)
      void queryClient.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

/*
  Мутации сбрасывают весь раздел `clients`, а не точечные ключи: приостановка
  меняет и карточку, и строку в списке, и журнал этого клиента. Экономить на
  инвалидации при таких объёмах не на чем, а рассинхрон между списком и
  карточкой заметен сразу.
*/
function useClientMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useSuspendClient(id: string) {
  return useClientMutation((reason: string) => suspendClient(id, reason))
}

export function useResumeClient(id: string) {
  return useClientMutation(() => resumeClient(id))
}

export function useIssueActivationCode(id: string) {
  return useClientMutation(() => issueActivationCode(id))
}

/**
 * Удаление стоит особняком от остальных мутаций по двум причинам.
 *
 * Во-первых, `onSuccess` объявлен на хуке, а не передаётся в `mutate()`:
 * колбэки из `mutate()` не вызываются, если компонент успел размонтироваться,
 * а он размонтируется — карточку удалённого клиента показывать больше негде.
 *
 * Во-вторых, порядок: сначала уходим со страницы, потом выбрасываем карточку
 * из кэша. Обычная инвалидация сходила бы за только что удалённым клиентом и
 * показала бы ошибку загрузки на долю секунды перед переходом.
 */
export function useDeleteClient(id: string, onDeleted?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => {
      onDeleted?.()
      queryClient.removeQueries({ queryKey: keys.detail(id) })
      queryClient.removeQueries({ queryKey: keys.tickets(id) })
      queryClient.removeQueries({ queryKey: keys.journal(id) })
      void queryClient.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

export type StatusCounts = Record<ClientFilter, number>

/** Счётчики для чипов. Считаются по всему списку, а не по отфильтрованному. */
export function countByStatus(clients: readonly Client[]): StatusCounts {
  const counts: StatusCounts = { all: clients.length, active: 0, trial: 0, paused: 0 }
  for (const client of clients) {
    counts[client.status] += 1
  }
  return counts
}

/**
 * Фильтрация и поиск — на клиенте: список всех клиентов помещается в один
 * ответ, а счётчики чипов всё равно требуют полного набора. Когда клиентов
 * станет столько, что это перестанет быть правдой, фильтр уезжает в query-
 * параметры `GET /api/v1/clients`, а счётчики — в отдельную ручку.
 */
export function filterClients(
  clients: readonly Client[],
  filter: ClientFilter,
  query: string,
): Client[] {
  const needle = query.trim().toLowerCase()
  return clients.filter(
    (client) =>
      (filter === 'all' || client.status === (filter as ClientStatus)) &&
      (needle === '' || client.name.toLowerCase().includes(needle)),
  )
}
