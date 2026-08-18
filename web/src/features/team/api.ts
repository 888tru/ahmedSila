import { request, USE_MOCK } from '@/lib/http'
import { mockTeamStore } from './mock'
import type { TeamMember, TeamRole } from './types'

export async function fetchTeam(signal?: AbortSignal): Promise<TeamMember[]> {
  if (USE_MOCK) return mockTeamStore.list()
  return request<TeamMember[]>('/team', { signal })
}

/**
 * Заводит приглашение, а не сотрудника: строка в таблице появится, когда он
 * перейдёт по ссылке и задаст пароль сам (см. `mock.ts`). Возвращает токен
 * активации: реальной отправки письма нет, ссылку нужно скопировать и
 * переслать вручную — тем же приёмом, что код подтверждения у клиента.
 */
export async function inviteTeamMember(email: string, role: TeamRole): Promise<string> {
  if (USE_MOCK) return mockTeamStore.invite(email, role)
  const invitation = await request<{ activation_token: string }>('/team/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
  return invitation.activation_token
}

export async function updateTeamMemberRole(id: string, role: TeamRole): Promise<TeamMember> {
  if (USE_MOCK) {
    const member = mockTeamStore.updateRole(id, role)
    if (!member) throw new Error(`Сотрудник ${id} не найден`)
    return member
  }
  return request<TeamMember>(`/team/${id}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
}

export async function revokeTeamMember(id: string): Promise<void> {
  if (USE_MOCK) {
    mockTeamStore.revoke(id)
    return
  }
  await request<void>(`/team/${id}`, { method: 'DELETE' })
}
