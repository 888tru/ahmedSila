import { useQuery } from '@tanstack/react-query'

import { fetchTickets } from './api'

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: ({ signal }) => fetchTickets(signal),
  })
}
