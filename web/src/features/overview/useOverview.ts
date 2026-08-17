import { useQuery } from '@tanstack/react-query'

import { fetchOverview } from './api'

/**
 * Обзор перезапрашивается при каждом возврате на вкладку, в отличие от списка
 * клиентов: это стартовый экран, на который возвращаются, чтобы узнать, что
 * изменилось, — а он бы показывал то же, что и час назад.
 */
export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: ({ signal }) => fetchOverview(signal),
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}
