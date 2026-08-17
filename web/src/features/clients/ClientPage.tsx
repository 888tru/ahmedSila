import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { ClientStatusDot } from '@/components/ui/StatusDot'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { ClientAccessTab } from './tabs/ClientAccessTab'
import { ClientJournalTab } from './tabs/ClientJournalTab'
import { ClientOverviewTab } from './tabs/ClientOverviewTab'
import { ClientTicketsTab } from './tabs/ClientTicketsTab'
import { useClient, useResumeClient } from './useClients'

const CLIENT_TABS = [
  { key: 'overview', label: 'Обзор' },
  { key: 'tickets', label: 'Обращения' },
  { key: 'journal', label: 'Журнал действий' },
  { key: 'access', label: 'Доступ и подписка' },
] as const

type ClientTab = (typeof CLIENT_TABS)[number]['key']

function isTab(value: string | undefined): value is ClientTab {
  return CLIENT_TABS.some((tab) => tab.key === value)
}

export function ClientPage() {
  const { clientId = '', tab } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const activeTab: ClientTab = isTab(tab) ? tab : 'overview'
  // Не деструктурируем: `data` сужается до `ClientDetail` только через сам
  // объект запроса, после деструктуризации TS теряет связь с флагами.
  const query = useClient(clientId)
  const client = query.data
  const resume = useResumeClient(clientId)

  const tabPath = (key: ClientTab) =>
    key === 'overview' ? `/clients/${clientId}` : `/clients/${clientId}/${key}`

  /*
    Кнопка в шапке работает в обе стороны: возобновление — действие без
    параметров, его выполняем сразу; приостановка требует причины, поэтому
    уводим на вкладку доступа с раскрытой формой. `?suspend=1` в адресе, а не
    в состоянии компонента, чтобы ссылку можно было переслать коллеге.
  */
  const onToggleAccess = () => {
    if (client?.status === 'paused') {
      resume.mutate(undefined)
    } else {
      void navigate(`${tabPath('access')}?suspend=1`)
    }
  }

  const breadcrumbs = [
    { label: 'Суперадминка' },
    { label: 'Клиенты', to: '/clients' },
    { label: client?.name ?? '…' },
  ]

  return (
    <AppShell active="clients" breadcrumbs={breadcrumbs}>
      {query.isError ? (
        <div className="px-5 pt-5">
          <div className="rounded-panel border border-line bg-surface">
            <ErrorState onRetry={() => void query.refetch()} />
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-line bg-surface px-5 pt-4">
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  {client ? (
                    <>
                      <h1 className="text-metric font-medium tracking-[-0.2px]">{client.name}</h1>
                      <ClientStatusDot status={client.status} />
                    </>
                  ) : (
                    <Skeleton className="my-1 h-4 w-52" />
                  )}
                </div>
                {client ? (
                  <div className="flex flex-wrap items-center gap-2.5 text-tiny text-ink-muted">
                    <span>{client.address}</span>
                    <Separator />
                    <span>Тариф {client.plan}</span>
                    <Separator />
                    <span>
                      Клиент с <span className="font-mono">{formatDate(client.createdAt)}</span>
                    </span>
                  </div>
                ) : (
                  <Skeleton className="h-3 w-80" />
                )}
              </div>

              <div className="ml-auto flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!client}
                  // Переписка живёт в обращениях: отдельного канала «написать» нет
                  onClick={() => void navigate(tabPath('tickets'))}
                >
                  Написать
                </Button>
                <Button size="sm" disabled={!client || resume.isPending} onClick={onToggleAccess}>
                  {client?.status === 'paused' ? 'Возобновить доступ' : 'Приостановить доступ'}
                </Button>
              </div>
            </div>

            <nav className="mt-4 flex gap-0.5" aria-label="Разделы клиента">
              {CLIENT_TABS.map((item) => (
                <Link
                  key={item.key}
                  to={tabPath(item.key)}
                  aria-current={item.key === activeTab ? 'page' : undefined}
                  className={cn(
                    'flex h-[34px] items-center border-b-2 px-3 text-body transition-colors duration-100',
                    item.key === activeTab
                      ? 'border-accent font-medium text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-[18px] pb-8">
            {activeTab === 'overview' && <ClientOverviewTab clientId={clientId} />}
            {activeTab === 'tickets' && <ClientTicketsTab clientId={clientId} />}
            {activeTab === 'journal' && <ClientJournalTab clientId={clientId} />}
            {activeTab === 'access' && (
              <ClientAccessTab
                clientId={clientId}
                suspendRequested={searchParams.get('suspend') === '1'}
              />
            )}
          </div>
        </>
      )}
    </AppShell>
  )
}

/** Тонкая вертикальная черта между пунктами метаданных в шапке. */
function Separator() {
  return <span aria-hidden className="h-[11px] w-px bg-line" />
}
