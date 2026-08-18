import { useQuery } from '@tanstack/react-query'

import { fetchJournal } from './api'

export function useJournal() {
  return useQuery({
    queryKey: ['journal'],
    queryFn: ({ signal }) => fetchJournal(signal),
  })
}
