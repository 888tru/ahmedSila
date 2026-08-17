import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { FilterChip } from '@/components/ui/FilterChip'
import { Select, Textarea } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { TicketStatusDot } from '@/components/ui/StatusDot'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { TICKET_STATUS_LABEL, type TicketStatus } from '@/features/clients/types'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, plural } from '@/lib/format'
import {
  ASSIGNEES,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  type GlobalTicket,
  type TicketAssigneeFilter,
  type TicketPriority,
  type TicketStatusFilter,
} from './types'
import { useTickets } from './useTickets'

/*
  Общий раздел «Обращения» (PAGES.md §5): та же переписка, что и на вкладке
  карточки клиента (`features/clients/tabs/ClientTicketsTab.tsx`), но сразу по
  всем клиентам и с колонкой клиента и приоритетом. Открытая переписка — тоже
  состояние экрана, а не адреса: у обращений пока нет собственных ссылок.
*/

const LIST_COLUMNS = '190px minmax(240px,1fr) 128px 108px 1px 130px 128px'
const LIST_SKELETON = ['w-32', 'w-56', 'w-16', 'w-14', null, 'w-20', 'w-16'] as const

const STATUSES: readonly TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']

const STATUS_TONE: Record<TicketStatus, 'ok' | 'warn' | 'danger' | 'muted'> = {
  open: 'danger',
  in_progress: 'warn',
  resolved: 'ok',
  closed: 'muted',
}

export function TicketsPage() {
  const { data, isPending, isError, refetch } = useTickets()
  const [status, setStatus] = useState<TicketStatusFilter>('all')
  const [assignee, setAssignee] = useState<TicketAssigneeFilter>('all')
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  // Приоритет меняется только в интерфейсе — правка не привязана к данным,
  // пока нет `POST /api/v1/tickets/:id` (см. mock.ts).
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, TicketPriority>>({})
  const [reply, setReply] = useState('')

  const tickets = useMemo(() => data ?? [], [data])
  const withPriority = useMemo(
    () => tickets.map((ticket) => ({ ...ticket, priority: priorityOverrides[ticket.id] ?? ticket.priority })),
    [tickets, priorityOverrides],
  )

  const filtered = withPriority.filter(
    (ticket) =>
      (status === 'all' || ticket.status === status) &&
      (assignee === 'all' ||
        (assignee === 'unassigned' ? ticket.assignee === null : ticket.assignee === assignee)),
  )

  const openTicket = withPriority.find((ticket) => ticket.id === openTicketId)
  const isEmpty = !isPending && !isError && tickets.length === 0
  const showEmptyFiltered = !isPending && !isError && !isEmpty && filtered.length === 0

  const openCount = tickets.filter((ticket) => ticket.status === 'open').length

  const resetFilters = () => {
    setStatus('all')
    setAssignee('all')
  }

  const closeThread = () => {
    setOpenTicketId(null)
    setReply('')
  }

  return (
    <AppShell active="tickets" breadcrumbs={[{ label: 'Суперадминка' }, { label: 'Обращения' }]}>
      <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-5 pb-8">
        <div className="flex flex-col gap-[3px]">
          <h1 className="text-title font-medium tracking-[-0.2px]">Обращения</h1>
          <span className="text-tiny text-ink-muted">
            {isPending
              ? 'Загружаем обращения'
              : isEmpty
                ? 'Все обращения от клиентов собираются здесь'
                : `${filtered.length} из ${tickets.length} ${plural(tickets.length, 'обращение', 'обращения', 'обращений')} · ${openCount} ${plural(openCount, 'открытое', 'открытых', 'открытых')}`}
          </span>
        </div>

        {!isPending && !isError && !isEmpty && !openTicket && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-mini text-ink-muted">Статус</span>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  label="Все"
                  count={tickets.length}
                  selected={status === 'all'}
                  onClick={() => setStatus('all')}
                />
                {STATUSES.map((key) => (
                  <FilterChip
                    key={key}
                    label={TICKET_STATUS_LABEL[key]}
                    count={tickets.filter((ticket) => ticket.status === key).length}
                    tone={STATUS_TONE[key]}
                    selected={status === key}
                    onClick={() => setStatus(key)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-mini text-ink-muted">Назначен</span>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip label="Все" selected={assignee === 'all'} onClick={() => setAssignee('all')} />
                {ASSIGNEES.map((name) => (
                  <FilterChip
                    key={name}
                    label={name}
                    selected={assignee === name}
                    onClick={() => setAssignee(name)}
                  />
                ))}
                <FilterChip
                  label="Не назначен"
                  selected={assignee === 'unassigned'}
                  onClick={() => setAssignee('unassigned')}
                />
              </div>
            </div>
          </div>
        )}

        {isError ? (
          <Panel>
            <ErrorState onRetry={() => void refetch()} />
          </Panel>
        ) : openTicket ? (
          <TicketThread
            ticket={openTicket}
            reply={reply}
            onReply={setReply}
            onBack={closeThread}
            onPriorityChange={(priority) =>
              setPriorityOverrides((state) => ({ ...state, [openTicket.id]: priority }))
            }
          />
        ) : isPending ? (
          <ListSkeleton />
        ) : isEmpty ? (
          <div className="rounded-panel border border-line bg-surface py-5">
            <EmptyState
              title="Обращений пока нет"
              hint="Когда клиенты напишут в поддержку, обращения появятся здесь."
              ctaLabel="Обновить"
              onCta={() => void refetch()}
            />
          </div>
        ) : showEmptyFiltered ? (
          <div className="rounded-panel border border-line bg-surface py-5">
            <EmptyState
              title="Нет обращений по этому фильтру"
              hint="Измените статус или сотрудника в фильтрах."
              ctaLabel="Сбросить фильтры"
              onCta={resetFilters}
            />
          </div>
        ) : (
          <TicketsList tickets={filtered} onOpen={setOpenTicketId} />
        )}
      </div>
    </AppShell>
  )
}

function TicketsList({
  tickets,
  onOpen,
}: {
  tickets: readonly GlobalTicket[]
  onOpen: (id: string) => void
}) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="max-h-[calc(100vh-250px)] overflow-auto">
        <div
          className="sticky top-0 z-[1] grid h-[34px] min-w-[1000px] items-center bg-surface px-[15px]"
          style={{ gridTemplateColumns: LIST_COLUMNS }}
        >
          <ColumnHeader className="pr-3.5">Клиент</ColumnHeader>
          <ColumnHeader className="pr-3.5">Тема</ColumnHeader>
          <ColumnHeader>Статус</ColumnHeader>
          <ColumnHeader>Приоритет</ColumnHeader>
          <span aria-hidden className="h-[34px] self-stretch bg-line" />
          <ColumnHeader className="pl-3.5">Назначен</ColumnHeader>
          <ColumnHeader className="text-right">Последнее сообщение</ColumnHeader>
        </div>

        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onOpen(ticket.id)}
            className={cn(
              'group grid h-[38px] min-w-[1000px] w-full items-center border-t border-line-soft px-[15px] text-left',
              'bg-surface transition-colors duration-100 hover:bg-surface-hover',
            )}
            style={{ gridTemplateColumns: LIST_COLUMNS }}
          >
            <Link
              to={`/clients/${ticket.clientId}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate pr-3.5 text-small text-accent transition-colors duration-100 hover:text-accent-hover"
            >
              {ticket.clientName}
            </Link>
            <span className="truncate pr-3.5 text-small text-ink transition-colors duration-100 group-hover:text-accent">
              {ticket.subject}
            </span>
            <TicketStatusDot status={ticket.status} />
            <span className="text-small text-ink-muted">{PRIORITY_LABEL[ticket.priority]}</span>
            <span aria-hidden className="h-[38px] self-stretch bg-line-soft" />
            <span className="truncate pl-3.5 text-small text-ink-muted">
              {ticket.assignee ?? 'Не назначен'}
            </span>
            <span className="text-right font-mono text-small text-ink-muted">
              {formatDate(ticket.lastMessageAt)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function TicketThread({
  ticket,
  reply,
  onReply,
  onBack,
  onPriorityChange,
}: {
  ticket: GlobalTicket
  reply: string
  onReply: (value: string) => void
  onBack: () => void
  onPriorityChange: (priority: TicketPriority) => void
}) {
  return (
    <Panel>
      <div className="flex min-h-11 flex-wrap items-center gap-3 border-b border-line px-[15px] py-2">
        <Button size="xs" onClick={onBack}>
          ← Все обращения
        </Button>
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-body font-medium">{ticket.subject}</span>
          <span className="text-mini text-ink-muted">
            Клиент: <Link to={`/clients/${ticket.clientId}`}>{ticket.clientName}</Link> · {ticket.city}
          </span>
        </div>
        <TicketStatusDot status={ticket.status} className="shrink-0" />
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-mini text-ink-muted">
            Приоритет
            <Select
              value={ticket.priority}
              onChange={(event) => onPriorityChange(event.target.value as TicketPriority)}
              className="w-auto"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </Select>
          </label>
          <span className="text-mini text-ink-muted">
            Назначен: {ticket.assignee ?? 'никто'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-canvas px-[15px] py-4">
        {ticket.messages.map((message) => {
          const fromTeam = message.author === 'team'
          return (
            <div
              key={message.id}
              className={cn('flex max-w-[74%] flex-col gap-1', fromTeam && 'self-end')}
            >
              <div className={cn('flex items-baseline gap-2', fromTeam && 'justify-end')}>
                <span className="text-mini font-medium text-ink">{message.authorName}</span>
                <span className="font-mono text-micro text-ink-muted">
                  {formatDateTime(message.sentAt)}
                </span>
              </div>
              <div
                className={cn(
                  'rounded-control border px-[11px] py-[9px] text-small leading-relaxed',
                  fromTeam ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface',
                )}
              >
                {message.text}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-[15px] py-3">
        <Textarea
          rows={3}
          value={reply}
          onChange={(event) => onReply(event.target.value)}
          placeholder="Написать ответ"
          aria-label="Ответ на обращение"
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            disabled={reply.trim() === ''}
            // Отправка появится вместе с `POST /api/v1/tickets/:id/messages`
            onClick={() => onReply('')}
          >
            Отправить
          </Button>
          {/* Назначение и статус — тоже без бэкенда: `POST /api/v1/tickets/:id` */}
          <Button size="sm">Назначить на себя</Button>
          <Button size="sm" disabled={ticket.status === 'resolved' || ticket.status === 'closed'}>
            Отметить решённым
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function ColumnHeader({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-micro font-medium text-ink-muted', className)}>{children}</span>
}

function ListSkeleton() {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div
        className="grid h-[34px] min-w-[1000px] items-center px-[15px]"
        style={{ gridTemplateColumns: LIST_COLUMNS }}
      >
        <ColumnHeader className="pr-3.5">Клиент</ColumnHeader>
        <ColumnHeader className="pr-3.5">Тема</ColumnHeader>
        <ColumnHeader>Статус</ColumnHeader>
        <ColumnHeader>Приоритет</ColumnHeader>
        <span aria-hidden className="h-[34px] self-stretch bg-line" />
        <ColumnHeader className="pl-3.5">Назначен</ColumnHeader>
        <ColumnHeader className="text-right">Последнее сообщение</ColumnHeader>
      </div>
      {Array.from({ length: 8 }, (_, row) => (
        <div
          key={row}
          className="grid h-[38px] min-w-[1000px] items-center gap-3.5 border-t border-line-soft px-[15px]"
          style={{ gridTemplateColumns: LIST_COLUMNS }}
        >
          {LIST_SKELETON.map((width, cell) =>
            width ? (
              <Skeleton key={cell} className={cn('h-3', width)} />
            ) : (
              <span key={cell} />
            ),
          )}
        </div>
      ))}
    </section>
  )
}
