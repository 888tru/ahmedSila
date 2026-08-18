import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchSettings, saveMessageTemplate } from './api'

const keys = { all: ['settings'] as const }

export function useSettings() {
  return useQuery({
    queryKey: keys.all,
    queryFn: ({ signal }) => fetchSettings(signal),
  })
}

export function useSaveMessageTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveMessageTemplate,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
