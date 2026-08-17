import { Panel } from '@/components/ui/Panel'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { useClientJournal } from '../useClients'

const ROW = 'grid grid-cols-[150px_1px_minmax(0,1fr)] items-center px-[15px]'

export function ClientJournalTab({ clientId }: { clientId: string }) {
  const query = useClientJournal(clientId)
  const entries = query.data

  if (query.isError) {
    return (
      <Panel>
        <ErrorState onRetry={() => void query.refetch()} />
      </Panel>
    )
  }

  if (!entries) {
    return (
      <Panel title="Действия команды по этому клиенту" hint="Только просмотр">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} aria-hidden className={cn(ROW, 'h-9 border-b border-line-soft')}>
            <Skeleton className="h-3 w-28" />
            <span className="self-stretch bg-line-soft" />
            <Skeleton className="ml-3.5 h-3 w-72" />
          </div>
        ))}
      </Panel>
    )
  }

  if (entries.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-2 px-6 py-13">
        <span className="text-lead font-medium">Пока нет записей</span>
        <span className="max-w-[360px] text-center text-small leading-normal text-ink-muted">
          Здесь появятся действия команды по этому клиенту: приостановка доступа, смена тарифа,
          новый код подтверждения.
        </span>
      </Panel>
    )
  }

  /*
    Журнал только читают: ни фильтров, ни действий по строке. Подпись
    «Только просмотр» в шапке — чтобы это было понятно до того, как человек
    начнёт искать, куда тут нажать.
  */
  return (
    <Panel title="Действия команды по этому клиенту" hint="Только просмотр">
      {entries.map((entry) => (
        <div key={entry.id} className={cn(ROW, 'min-h-9 border-b border-line-soft py-1.5')}>
          <span className="font-mono text-small text-ink-muted">
            {formatDateTime(entry.occurredAt)}
          </span>
          <span aria-hidden className="self-stretch bg-line-soft" />
          <span className="pl-3.5 text-small">{entry.text}</span>
        </div>
      ))}
    </Panel>
  )
}
