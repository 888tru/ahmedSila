import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchTeam, inviteTeamMember, revokeTeamMember, updateTeamMemberRole } from './api'
import type { TeamRole } from './types'

const keys = { all: ['team'] as const }

export function useTeam() {
  return useQuery({
    queryKey: keys.all,
    queryFn: ({ signal }) => fetchTeam(signal),
  })
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: TeamRole }) => inviteTeamMember(email, role),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateTeamMemberRole(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: TeamRole) => updateTeamMemberRole(id, role),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useRevokeTeamMember(id: string, onRevoked?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => revokeTeamMember(id),
    onSuccess: () => {
      onRevoked?.()
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })
}
