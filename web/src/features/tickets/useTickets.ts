import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { TicketStatus } from '@/features/clients/types'
import {
  assignTicketToSelf,
  fetchTicket,
  fetchTickets,
  replyToTicket,
  updateTicketPriority,
  updateTicketStatus,
} from './api'
import type { TicketPriority } from './types'

const keys = {
  all: ['tickets'] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
}

export function useTickets() {
  return useQuery({
    queryKey: keys.all,
    queryFn: ({ signal }) => fetchTickets(signal),
  })
}

/** Тред — отдельным запросом: список не тащит переписку (см. api.ts). */
export function useTicket(id: string | null) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchTicket(id as string, signal),
    enabled: id !== null,
  })
}

/*
  Мутации сбрасывают весь раздел `tickets`, а не точечные ключи: ответ меняет
  и тред (новое сообщение, время последнего), и строку в списке (последнее
  сообщение) — то же решение, что для клиентов в useClients.ts.
*/
function useTicketMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useReplyToTicket(id: string) {
  return useTicketMutation((text: string) => replyToTicket(id, text))
}

export function useAssignTicketToSelf(id: string) {
  return useTicketMutation(() => assignTicketToSelf(id))
}

export function useUpdateTicketStatus(id: string) {
  return useTicketMutation((status: TicketStatus) => updateTicketStatus(id, status))
}

export function useUpdateTicketPriority(id: string) {
  return useTicketMutation((priority: TicketPriority) => updateTicketPriority(id, priority))
}
