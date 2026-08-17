import {
  STATUS_LABEL,
  TICKET_STATUS_LABEL,
  type ClientStatus,
  type TicketStatus,
} from '@/features/clients/types'
import { cn } from '@/lib/cn'
import { DOT, type Tone } from './tone'

/**
 * Статус точкой + текстом, а не цветным бейджем: в плотной таблице заливка
 * на каждой строке даёт полосатый шум и мешает читать соседние колонки.
 */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: Tone
  label: string
  className?: string
}) {
  return (
    <span className={cn('flex items-center gap-[7px]', className)}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} />
      <span className="text-small text-ink">{label}</span>
    </span>
  )
}

const CLIENT_TONE: Record<ClientStatus, Tone> = {
  active: 'ok',
  trial: 'warn',
  paused: 'danger',
}

export function ClientStatusDot({ status }: { status: ClientStatus }) {
  return <StatusDot tone={CLIENT_TONE[status]} label={STATUS_LABEL[status]} />
}

// «Закрыто» серым, а не зелёным: закрыли — не значит решили.
const TICKET_TONE: Record<TicketStatus, Tone> = {
  open: 'danger',
  in_progress: 'warn',
  resolved: 'ok',
  closed: 'muted',
}

export function TicketStatusDot({
  status,
  className,
}: {
  status: TicketStatus
  className?: string
}) {
  return (
    <StatusDot
      tone={TICKET_TONE[status]}
      label={TICKET_STATUS_LABEL[status]}
      className={className}
    />
  )
}
