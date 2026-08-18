import type { TeamMember, TeamRole } from './types'

/*
  Демо-данные и мутирующий стор в памяти — тот же приём, что в
  `features/clients/mock.ts`: смена роли и отзыв доступа должны вести себя как
  настоящие, иначе не проверить ни инвалидацию кэша, ни перерисовку.

  Существует, пока в бэкенде нет ручек по команде (см. CLAUDE.md, «Состояние»).
*/

const daysAgo = (d: number, hour: number, minute: number): string => {
  const date = new Date(Date.now() - d * 24 * 60 * 60_000)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

let members: TeamMember[] = [
  { id: '1', name: 'Айдар Керимов', email: 'a.kerimov@example.kz', role: 'owner', twoFactorEnabled: true, lastLoginAt: daysAgo(3, 9, 2), isMe: true },
  { id: '2', name: 'Динара Тлеубаева', email: 'd.tleubaeva@example.kz', role: 'admin', twoFactorEnabled: true, lastLoginAt: daysAgo(3, 8, 41), isMe: false },
  { id: '3', name: 'Сауле Молдагалиева', email: 's.moldagalieva@example.kz', role: 'support', twoFactorEnabled: true, lastLoginAt: daysAgo(4, 19, 15), isMe: false },
  { id: '4', name: 'Руслан Алиев', email: 'r.aliev@example.kz', role: 'support', twoFactorEnabled: false, lastLoginAt: null, isMe: false },
  { id: '5', name: 'Мария Штерн', email: 'm.shtern@example.kz', role: 'viewer', twoFactorEnabled: false, lastLoginAt: daysAgo(15, 11, 30), isMe: false },
]

export const mockTeamStore = {
  list(): TeamMember[] {
    return members.map((member) => ({ ...member }))
  },

  isEmailTaken(email: string): boolean {
    const needle = email.trim().toLowerCase()
    return members.some((member) => member.email.toLowerCase() === needle)
  },

  /**
   * Приглашение не заводит строку в таблице сразу: сотрудник появляется в
   * команде, только когда примет ссылку и задаст пароль сам — до этого его
   * ещё формально нет в системе, показывать нечего.
   *
   * Токен возвращается тем же приёмом, что код подтверждения у клиента:
   * реальной отправки письма ещё нет (см. CLAUDE.md, «Дальше»), поэтому
   * ссылку нужно скопировать и переслать вручную — иначе приглашение
   * никуда не долетит.
   */
  invite(email: string, _role: TeamRole): string {
    if (this.isEmailTaken(email)) {
      throw new Error('Этот сотрудник уже есть в команде')
    }
    return randomToken()
  },

  updateRole(id: string, role: TeamRole): TeamMember | undefined {
    const member = members.find((item) => item.id === id)
    if (!member || member.role === 'owner') return undefined
    member.role = role
    return { ...member }
  },

  revoke(id: string): void {
    const member = members.find((item) => item.id === id)
    if (!member || member.role === 'owner') return
    members = members.filter((item) => item.id !== id)
  },
}

function randomToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}
