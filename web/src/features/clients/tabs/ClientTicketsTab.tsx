import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { TicketStatusDot } from '@/components/ui/StatusDot'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Ticket } from '../types'
import { useClientTickets } from '../useClients'

const GRID = 'grid grid-cols-[minmax(0,1fr)_130px_110px_1px_130px] items-center px-[15px]'

export function ClientTicketsTab({ clientId }: { clientId: string }) {
  // Открытая переписка — состояние экрана, а не адреса: обращения ещё не имеют
  // собственных ссылок, они появятся вместе с общим разделом поддержки.
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)

  const query = useClientTickets(clientId)
  const tickets = query.data

  if (query.isError) {
    return (
      <Panel>
        <ErrorState onRetry={() => void query.refetch()} />
      </Panel>
    )
  }

  if (!tickets) {
    return <TicketsSkeleton />
  }

  const open = tickets.find((ticket) => ticket.id === openTicketId)
  if (open) {
    return <TicketThread ticket={open} onBack={() => setOpenTicketId(null)} />
  }

  if (tickets.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-2 px-6 py-13">
        <span className="text-lead font-medium">Обращений пока нет</span>
        <span className="max-w-[360px] text-center text-small leading-normal text-ink-muted">
          Когда клиент напишет в поддержку, обращение появится здесь.
        </span>
      </Panel>
    )
  }

  return (
    <Panel>
      <div className={cn(GRID, 'h-[34px] border-b border-line')} role="row">
        <span className="pr-3.5 text-micro font-medium text-ink-muted">Тема</span>
        <span className="text-micro font-medium text-ink-muted">Статус</span>
        <span className="text-micro font-medium text-ink-muted">Назначен</span>
        <span aria-hidden className="self-stretch bg-line" />
        <span className="text-right text-micro font-medium text-ink-muted">
          Последнее сообщение
        </span>
      </div>

      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          type="button"
          onClick={() => setOpenTicketId(ticket.id)}
          className={cn(
            GRID,
            'group h-9 w-full border-b border-line-soft bg-surface text-left',
            'transition-colors duration-100 hover:bg-surface-hover',
          )}
        >
          <span className="truncate pr-3.5 text-small text-ink transition-colors duration-100 group-hover:text-accent">
            {ticket.subject}
          </span>
          <TicketStatusDot status={ticket.status} />
          <span className="truncate text-small text-ink-muted">
            {ticket.assignee ?? 'Не назначен'}
          </span>
          <span aria-hidden className="self-stretch bg-line-soft" />
          <span className="text-right font-mono text-small text-ink-muted">
            {formatDate(ticket.lastMessageAt)}
          </span>
        </button>
      ))}
    </Panel>
  )
}

function TicketThread({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  const [reply, setReply] = useState('')

  return (
    <Panel>
      <div className="flex min-h-11 items-center gap-3 border-b border-line px-[15px] py-2">
        <Button size="xs" onClick={onBack}>
          ← Все обращения
        </Button>
        <span className="min-w-0 truncate text-body font-medium">{ticket.subject}</span>
        <TicketStatusDot status={ticket.status} className="shrink-0" />
        <span className="ml-auto shrink-0 text-mini text-ink-muted">
          Назначен: {ticket.assignee ?? 'никто'}
        </span>
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
              {/* Сообщения команды — на мягкой акцентной подложке справа:
                  различать стороны переписки цветом дешевле, чем подписью */}
              <div
                className={cn(
                  'rounded-control border px-[11px] py-[9px] text-small leading-relaxed',
                  fromTeam
                    ? 'border-accent-line bg-accent-soft'
                    : 'border-line bg-surface',
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
          onChange={(event) => setReply(event.target.value)}
          placeholder="Написать ответ"
          aria-label="Ответ на обращение"
        />
        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            disabled={reply.trim() === ''}
            // Отправка появится вместе с `POST /api/v1/tickets/:id/messages`
            onClick={() => setReply('')}
          >
            Отправить
          </Button>
          <Button size="sm" disabled={ticket.status === 'resolved' || ticket.status === 'closed'}>
            Отметить решённым
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function TicketsSkeleton() {
  return (
    <Panel>
      <div className={cn(GRID, 'h-[34px] border-b border-line')}>
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-16" />
        <span aria-hidden className="self-stretch bg-line" />
        <Skeleton className="h-2.5 w-24 justify-self-end" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} aria-hidden className={cn(GRID, 'h-9 border-b border-line-soft')}>
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
          <span className="self-stretch bg-line-soft" />
          <Skeleton className="h-3 w-16 justify-self-end" />
        </div>
      ))}
    </Panel>
  )
}
