import { Button } from '@/components/ui/Button'
import { DefinitionList, Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber, formatRelative, plural } from '@/lib/format'
import { useClient } from '../useClients'

export function ClientOverviewTab({ clientId }: { clientId: string }) {
  const client = useClient(clientId).data

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-3 overflow-hidden rounded-panel border border-line bg-surface">
        <Metric
          label="Сотрудников в системе"
          value={client && formatNumber(client.employees)}
        />
        <Metric
          label={
            client
              ? `Последняя активность · ${formatDateTime(client.lastActiveAt)}`
              : 'Последняя активность'
          }
          value={client && formatRelative(client.lastActiveAt)}
          // Здесь значение — фраза, а не число: моноширинный шрифт ему не нужен
          text
        />
        <Metric
          label={
            client
              ? plural(
                  client.openTickets,
                  'Открытое обращение',
                  'Открытых обращения',
                  'Открытых обращений',
                )
              : 'Открытых обращений'
          }
          value={client && formatNumber(client.openTickets)}
          last
        />
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <ProcurementPanel />

        <Panel title="Контакты">
          {client ? (
            <DefinitionList
              items={[
                { label: 'Владелец', value: client.ownerName },
                { label: 'Телефон', value: <span className="font-mono">{client.phone}</span> },
                {
                  label: 'Email',
                  value: (
                    <a
                      href={`mailto:${client.email}`}
                      className="text-accent hover:text-accent-hover"
                    >
                      {client.email}
                    </a>
                  ),
                },
              ]}
            />
          ) : (
            <div className="flex flex-col gap-3.5 p-[15px]">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  text = false,
  last = false,
}: {
  label: string
  value: string | undefined
  text?: boolean
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[3px] px-[15px] py-[13px]',
        !last && 'border-r border-line-soft',
      )}
    >
      {value === undefined ? (
        <Skeleton className="my-1 h-5 w-16" />
      ) : (
        <span
          className={cn(
            'font-medium',
            text ? 'text-[15px] leading-snug' : 'font-mono text-[22px] leading-none',
          )}
        >
          {value}
        </span>
      )}
      <span className="text-mini text-ink-muted">{label}</span>
    </div>
  )
}

/*
  Закупки — главный содержательный показатель по клиенту (DESIGN_BRIEF), но
  данные появятся только когда в целевом сервисе заработает модуль заявок:
  модель под них (`tenant_procurement_snapshots`) заложена, gRPC-контракта ещё
  нет. Поэтому раздел стоит на месте с пустым состоянием, а не спрятан — место
  в интерфейсе уже отведено и не придётся перекраивать вёрстку задним числом.
*/
function ProcurementPanel() {
  return (
    <Panel
      title="Закупки у поставщиков"
      hint="за 30 дней"
      action={
        <Button size="xs" disabled title="Появится вместе с модулем заявок">
          Обновить
        </Button>
      }
    >
      <div className="grid h-8 grid-cols-[minmax(0,1fr)_1px_90px_120px] items-center border-b border-line-soft px-[15px]">
        <span className="text-micro font-medium text-ink-muted">Товар</span>
        <span aria-hidden className="self-stretch bg-line" />
        <span className="pr-2.5 text-right text-micro font-medium text-ink-muted">Кол-во</span>
        <span className="text-right text-micro font-medium text-ink-muted">Цена закупки</span>
      </div>

      <div className="flex flex-col items-center gap-[9px] px-6 pt-11 pb-[46px]">
        <span aria-hidden className="flex h-[26px] items-end gap-1 opacity-50">
          <span className="h-2.5 w-[9px] rounded-[2px] border border-line bg-line-soft" />
          <span className="h-[18px] w-[9px] rounded-[2px] border border-line bg-line-soft" />
          <span className="h-3.5 w-[9px] rounded-[2px] border border-line bg-line-soft" />
        </span>
        <span className="text-lead font-medium">Данных о закупках пока нет</span>
        <span className="max-w-[380px] text-center text-small leading-normal text-ink-muted">
          Здесь появятся товары, количество и цены из заявок операторов, когда клиент начнёт
          оформлять закупки у поставщиков.
        </span>
      </div>
    </Panel>
  )
}
