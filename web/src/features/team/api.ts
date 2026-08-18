import { request, USE_MOCK } from '@/lib/http'
import { mockTeamStore } from './mock'
import type { TeamMember, TeamRole } from './types'

interface TeamMemberWire {
  id: string
  name: string
  email: string
  role: TeamRole
  two_factor_enabled: boolean
  last_login_at: string | null
  is_me: boolean
}

function fromWire(m: TeamMemberWire): TeamMember {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    twoFactorEnabled: m.two_factor_enabled,
    lastLoginAt: m.last_login_at,
    isMe: m.is_me,
  }
}

export async function fetchTeam(signal?: AbortSignal): Promise<TeamMember[]> {
  if (USE_MOCK) return mockTeamStore.list()
  const members = await request<TeamMemberWire[]>('/team', { signal })
  return members.map(fromWire)
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
  const wire = await request<TeamMemberWire>(`/team/${id}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
  return fromWire(wire)
}

export async function revokeTeamMember(id: string): Promise<void> {
  if (USE_MOCK) {
    mockTeamStore.revoke(id)
    return
  }
  await request<void>(`/team/${id}`, { method: 'DELETE' })
}
