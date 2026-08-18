import { useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { FilterChip } from '@/components/ui/FilterChip'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDateTime, plural } from '@/lib/format'
import {
  INVITABLE_ROLES,
  ROLE_HINT,
  ROLE_LABEL,
  ROLE_TONE,
  type TeamMember,
  type TeamRole,
} from './types'
import { useInviteTeamMember, useRevokeTeamMember, useTeam, useUpdateTeamMemberRole } from './useTeam'

const LIST_COLUMNS = '190px minmax(220px,1fr) 150px 1px 130px 150px'
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function TeamPage() {
  const { data, isPending, isError, refetch } = useTeam()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [sent, setSent] = useState<{ email: string; token: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const members = data ?? []
  const selected = members.find((member) => member.id === selectedId)
  const tfaOff = members.filter((member) => !member.twoFactorEnabled).length

  return (
    <AppShell active="team" breadcrumbs={[{ label: 'Суперадминка' }, { label: 'Команда' }]}>
      <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-5 pb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-[3px]">
            <h1 className="text-title font-medium tracking-[-0.2px]">Команда</h1>
            <span className="text-tiny text-ink-muted">
              {isPending
                ? 'Загружаем команду'
                : `${members.length} ${plural(members.length, 'сотрудник', 'сотрудника', 'сотрудников')} · ${
                    tfaOff > 0
                      ? `у ${tfaOff} не включена двухфакторная`
                      : 'двухфакторная включена у всех'
                  }`}
            </span>
          </div>
          <Button
            variant="primary"
            className="ml-auto"
            onClick={() => setInviteOpen(true)}
          >
            Пригласить сотрудника
          </Button>
        </div>

        {sent && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-panel border border-line bg-surface px-3.5 py-[11px]">
            <span aria-hidden className="mt-[3px] size-1.5 shrink-0 self-start rounded-full bg-ok" />
            <span className="text-small leading-relaxed">
              Приглашение заведено для <span className="font-mono">{sent.email}</span>. Ссылка
              активации действует 7 дней — реальная отправка письма ещё не подключена, скопируйте
              ссылку и перешлите её сами.
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                size="xs"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`${window.location.origin}/invite/${sent.token}`)
                    .then(() => {
                      setLinkCopied(true)
                      window.setTimeout(() => setLinkCopied(false), 2000)
                    })
                }}
              >
                {linkCopied ? 'Скопировано' : 'Скопировать ссылку'}
              </Button>
              <Button size="xs" onClick={() => setSent(null)}>
                Понятно
              </Button>
            </div>
          </div>
        )}

        {isError ? (
          <div className="rounded-panel border border-line bg-surface">
            <ErrorState onRetry={() => void refetch()} />
          </div>
        ) : (
          <>
            <TeamTable
              members={members}
              loading={isPending}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <MemberDetail
                key={selected.id}
                member={selected}
                onClose={() => setSelectedId(null)}
              />
            )}
          </>
        )}
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onSent={(email, token) => {
            setInviteOpen(false)
            setSent({ email, token })
          }}
        />
      )}
    </AppShell>
  )
}

function TeamTable({
  members,
  loading,
  selectedId,
  onSelect,
}: {
  members: readonly TeamMember[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="max-h-[calc(100vh-260px)] overflow-auto">
        <div
          className="sticky top-0 z-[1] grid h-[34px] min-w-[900px] items-center bg-surface px-[15px]"
          style={{ gridTemplateColumns: LIST_COLUMNS }}
        >
          <ColumnHeader className="pr-3.5">Имя</ColumnHeader>
          <ColumnHeader className="pr-3.5">Email</ColumnHeader>
          <ColumnHeader>Роль</ColumnHeader>
          <span aria-hidden className="h-[34px] self-stretch bg-line" />
          <ColumnHeader className="pl-3.5">Двухфакторная</ColumnHeader>
          <ColumnHeader className="text-right">Последний вход</ColumnHeader>
        </div>

        {loading
          ? Array.from({ length: 5 }, (_, row) => (
              <div
                key={row}
                className="grid h-[38px] min-w-[900px] items-center gap-3.5 border-t border-line-soft px-[15px]"
                style={{ gridTemplateColumns: LIST_COLUMNS }}
              >
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-16" />
                <span />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24 justify-self-end" />
              </div>
            ))
          : members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelect(member.id)}
                aria-pressed={member.id === selectedId}
                className={cn(
                  'group grid h-[38px] min-w-[900px] w-full items-center border-t border-line-soft px-[15px] text-left',
                  'bg-surface transition-colors duration-100 hover:bg-surface-hover',
                  member.id === selectedId && 'bg-surface-hover',
                )}
                style={{ gridTemplateColumns: LIST_COLUMNS }}
              >
                <span className="truncate pr-3.5 text-small text-ink transition-colors duration-100 group-hover:text-accent">
                  {member.name}
                  {member.isMe && <span className="text-ink-muted"> · это вы</span>}
                </span>
                <span className="truncate pr-3.5 font-mono text-mini text-ink-muted">
                  {member.email}
                </span>
                <span className="text-small">{ROLE_LABEL[member.role]}</span>
                <span aria-hidden className="h-[38px] self-stretch bg-line-soft" />
                <span
                  className={cn(
                    'flex items-center gap-1.5 pl-3.5 text-small',
                    member.twoFactorEnabled ? 'text-ink' : 'text-ink-muted',
                  )}
                >
                  {member.twoFactorEnabled ? '✓' : '✕'} {member.twoFactorEnabled ? 'Включена' : 'Не включена'}
                </span>
                <span className="text-right font-mono text-small text-ink-muted">
                  {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : 'не входил'}
                </span>
              </button>
            ))}
      </div>
    </section>
  )
}

function MemberDetail({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [revokeOpen, setRevokeOpen] = useState(false)
  const updateRole = useUpdateTeamMemberRole(member.id)
  const locked = member.role === 'owner'

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex min-h-[38px] flex-wrap items-center gap-3 border-b border-line px-[15px] py-2">
        <span className="text-body font-medium">{member.name}</span>
        <span className="font-mono text-mini text-ink-muted">{member.email}</span>
        <Button size="xs" className="ml-auto" onClick={onClose}>
          Закрыть
        </Button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <div className="flex flex-col gap-2 border-r border-line-soft px-[15px] py-3.5">
          <span className="text-small font-medium">Роль</span>
          <Select
            value={member.role}
            disabled={locked}
            className={cn('w-auto self-start', locked && 'bg-canvas')}
            onChange={(event) => updateRole.mutate(event.target.value as TeamRole)}
          >
            {/* Владельца нет в списке: передача владения — отдельный флоу,
                не пункт в общем выборе роли (см. usecase/team.go на бэкенде). */}
            {INVITABLE_ROLES.map((key) => (
              <option key={key} value={key}>
                {ROLE_LABEL[key]}
              </option>
            ))}
          </Select>
          <span className="text-mini leading-normal text-ink-muted">
            {locked ? ROLE_HINT.owner : ROLE_HINT[member.role]}
          </span>
        </div>

        <div className="flex flex-col gap-2 px-[15px] py-3.5">
          <span className="text-small font-medium">Отозвать доступ</span>
          <Button
            variant={locked ? 'secondary' : 'destructive'}
            size="sm"
            className="self-start"
            disabled={locked}
            onClick={() => setRevokeOpen(true)}
          >
            Отозвать доступ
          </Button>
          <span className="text-mini leading-normal text-ink-muted">
            {locked
              ? 'У владельца нельзя отозвать доступ. Сначала передайте роль владельца другому сотруднику.'
              : 'Сотрудник сразу потеряет доступ, активные сессии будут закрыты. Потребуется подтверждение.'}
          </span>
        </div>
      </div>

      {revokeOpen && (
        <RevokeModal member={member} onClose={() => setRevokeOpen(false)} onRevoked={onClose} />
      )}
    </section>
  )
}

function RevokeModal({
  member,
  onClose,
  onRevoked,
}: {
  member: TeamMember
  onClose: () => void
  onRevoked: () => void
}) {
  const [confirmEmail, setConfirmEmail] = useState('')
  const revoke = useRevokeTeamMember(member.id, onRevoked)
  const canRevoke = confirmEmail.trim() === member.email

  return (
    <Modal
      title="Отозвать доступ"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            disabled={!canRevoke || revoke.isPending}
            onClick={() => canRevoke && revoke.mutate(undefined)}
          >
            Отозвать доступ
          </Button>
          <Button size="sm" className="h-8" onClick={onClose}>
            Отмена
          </Button>
        </>
      }
    >
      <span className="text-small leading-relaxed text-ink-muted">
        {member.name} потеряет доступ к суперадминке сразу, активные сессии будут закрыты. Записи в
        журнале действий останутся. Действие необратимо.
      </span>
      <div className="flex flex-col gap-1.5">
        <label className="text-tiny" htmlFor="confirm-member-email">
          Введите email сотрудника: <span className="font-mono font-medium">{member.email}</span>
        </label>
        <Input
          id="confirm-member-email"
          className="h-8"
          value={confirmEmail}
          placeholder={member.email}
          onChange={(event) => setConfirmEmail(event.target.value)}
        />
      </div>
    </Modal>
  )
}

function InviteModal({
  onClose,
  onSent,
}: {
  onClose: () => void
  onSent: (email: string, token: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('support')
  const [error, setError] = useState('')
  const invite = useInviteTeamMember()

  const onSubmit = () => {
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setError('Проверьте адрес: похоже, в нём опечатка')
      return
    }
    invite.mutate(
      { email: value, role },
      {
        onSuccess: (token) => onSent(value, token),
        onError: (mutationError) => setError(mutationError.message),
      },
    )
  }

  return (
    <Modal
      title="Пригласить сотрудника"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" size="sm" className="h-8" disabled={invite.isPending} onClick={onSubmit}>
            Отправить приглашение
          </Button>
          <Button size="sm" className="h-8" onClick={onClose}>
            Отмена
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-tiny text-ink-muted" htmlFor="invite-email">
          Рабочий email
        </label>
        <Input
          id="invite-email"
          className="h-8 font-mono"
          value={email}
          invalid={error !== ''}
          placeholder="name@example.kz"
          onChange={(event) => {
            setEmail(event.target.value)
            setError('')
          }}
        />
        {error && <span className="text-mini text-danger">{error}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-tiny text-ink-muted">Роль</span>
        <div className="flex flex-wrap gap-1.5">
          {INVITABLE_ROLES.map((key) => (
            <FilterChip
              key={key}
              label={ROLE_LABEL[key]}
              tone={ROLE_TONE[key]}
              selected={role === key}
              onClick={() => setRole(key)}
            />
          ))}
        </div>
        <span className="text-mini leading-normal text-ink-muted">{ROLE_HINT[role]}</span>
      </div>
    </Modal>
  )
}

function ColumnHeader({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-micro font-medium text-ink-muted', className)}>{children}</span>
}
