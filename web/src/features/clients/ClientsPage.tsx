import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTable } from '@tanstack/react-table'

import { AppShell } from '@/components/layout/AppShell'
import { Button, LinkButton } from '@/components/ui/Button'
import { FilterChip } from '@/components/ui/FilterChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { plural } from '@/lib/format'
import { ClientsMetrics } from './ClientsMetrics'
import { ClientsTable, ClientsTableSkeleton } from './ClientsTable'
import { buildColumns } from './columns'
import { clientsTableFeatures } from './table'
import { FILTERS, STATUS_LABEL, type ClientFilter } from './types'
import { countByStatus, filterClients, useClients } from './useClients'

type Density = 'compact' | 'cozy'

const DENSITY_SEGMENTS = [
  { value: 'compact' as const, label: 'Компактно' },
  { value: 'cozy' as const, label: 'Комфортно' },
]

const PAGE_SIZE_SEGMENTS = [25, 50, 100].map((size) => ({ value: size, label: String(size) }))

function isFilter(value: string | null): value is ClientFilter {
  return FILTERS.some((item) => item.key === value)
}

export function ClientsPage() {
  const navigate = useNavigate()
  /*
    Фильтр живёт в адресе, а не в состоянии компонента: с «Обзора» сюда ведёт
    ссылка «Все триалы», и она должна открывать список уже отфильтрованным.
    Значение по умолчанию («Все») параметра не добавляет — чистый `/clients`
    остаётся каноническим адресом раздела.
  */
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const filter: ClientFilter = isFilter(statusParam) ? statusParam : 'all'
  const [query, setQuery] = useState('')
  const [density, setDensity] = useState<Density>('compact')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })

  // Смена фильтра заменяет запись в истории, а не добавляет: иначе «назад»
  // после пары кликов по чипам не возвращает туда, откуда пришли.
  const setFilter = (next: ClientFilter) => {
    setSearchParams(next === 'all' ? {} : { status: next }, { replace: true })
    setPagination((state) => ({ ...state, pageIndex: 0 }))
  }

  const { data, isPending, isError, refetch } = useClients()
  const clients = useMemo(() => data ?? [], [data])
  const cozy = density === 'cozy'

  const counts = useMemo(() => countByStatus(clients), [clients])
  const rows = useMemo(
    () => filterClients(clients, filter, query),
    [clients, filter, query],
  )

  const columns = useMemo(() => buildColumns({ cozy }), [cozy])

  const table = useTable({
    features: clientsTableFeatures,
    data: rows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
  })

  // Пустой фильтр и пустая база — разные состояния: в первом случае звать
  // «создать клиента» бессмысленно, нужно снять фильтр.
  const filterIsNarrowed = filter !== 'all' || query.trim() !== ''
  const showEmpty = !isPending && !isError && rows.length === 0

  const { pageIndex, pageSize } = pagination
  const rangeLabel =
    rows.length === 0
      ? '0 из 0'
      : `${pageIndex * pageSize + 1}–${Math.min(rows.length, (pageIndex + 1) * pageSize)} из ${rows.length}`

  const emptyFilterTitle = query.trim()
    ? 'Ничего не найдено'
    : `Нет клиентов со статусом «${filter === 'all' ? '' : STATUS_LABEL[filter]}»`

  return (
    <AppShell
      active="clients"
      breadcrumbs={[{ label: 'Суперадминка' }, { label: 'Клиенты' }]}
      search={{
        value: query,
        onChange: (value) => {
          setQuery(value)
          setPagination((state) => ({ ...state, pageIndex: 0 }))
        },
        placeholder: 'Поиск по названию',
      }}
    >
      <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-5 pb-7">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-[3px]">
            <h1 className="text-title font-medium tracking-[-0.2px]">Клиенты</h1>
            <span className="text-tiny text-ink-muted">
              {isPending
                ? 'Загружаем список'
                : `${clients.length} ${plural(clients.length, 'клиент', 'клиента', 'клиентов')} в системе`}
            </span>
          </div>
          <LinkButton variant="primary" className="ml-auto" to="/clients/new">
            + Клиент
          </LinkButton>
        </div>

        <ClientsMetrics counts={counts} loading={isPending} />

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              count={counts[item.key]}
              selected={filter === item.key}
              onClick={() => setFilter(item.key)}
            />
          ))}

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-mini text-ink-muted">Плотность</span>
            <SegmentedControl
              label="Плотность строк"
              segments={DENSITY_SEGMENTS}
              value={density}
              onChange={setDensity}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="max-h-[calc(100vh-250px)] overflow-auto">
            {isError ? (
              <ErrorState onRetry={() => void refetch()} />
            ) : (
              <>
                <div role="table" aria-label="Клиенты" aria-rowcount={rows.length}>
                  {isPending ? (
                    <ClientsTableSkeleton cozy={cozy} />
                  ) : (
                    <ClientsTable table={table} cozy={cozy} />
                  )}
                </div>

                {showEmpty &&
                  (filterIsNarrowed ? (
                    <EmptyState
                      title={emptyFilterTitle}
                      hint="Измените фильтр или уточните запрос."
                      ctaLabel="Показать всех"
                      onCta={() => {
                        setFilter('all')
                        setQuery('')
                      }}
                    />
                  ) : (
                    <EmptyState
                      title="Пока нет клиентов"
                      hint="Добавьте первого клиента, чтобы начать работу."
                      ctaLabel="Создать клиента"
                      onCta={() => void navigate('/clients/new')}
                    />
                  ))}
              </>
            )}
          </div>

          <div className="flex h-10 items-center gap-3.5 border-t border-line bg-surface px-3.5">
            <span className="text-mini text-ink-muted">Строк на странице</span>
            <SegmentedControl
              mono
              label="Строк на странице"
              segments={PAGE_SIZE_SEGMENTS}
              value={pageSize}
              onChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
            />
            <span className="ml-auto font-mono text-mini text-ink-muted">{rangeLabel}</span>
            <div className="flex gap-1">
              <Button
                size="xs"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Назад
              </Button>
              <Button size="xs" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                Вперёд
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
