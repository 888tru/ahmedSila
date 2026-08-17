import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router'

import { LinkButton } from '@/components/ui/Button'
import { ClientStatusDot } from '@/components/ui/StatusDot'
import { formatDate, formatNumber, formatRelative } from '@/lib/format'
import type { ClientsTableFeatures } from './table'
import type { Client } from './types'

const helper = createColumnHelper<ClientsTableFeatures, Client>()

export interface ColumnsOptions {
  /** Комфортная плотность — под названием показываем город и тариф. */
  cozy: boolean
}

const clientPath = (client: Client) => `/clients/${client.id}`

/*
  Порядок колонок обязан совпадать с grid-template-columns в `.ledger-grid`
  (см. index.css): ширины заданы там, а не здесь, потому что одна и та же
  сетка держит и шапку, и строки.
*/
export function buildColumns({ cozy }: ColumnsOptions) {
  return helper.columns([
    helper.accessor('name', {
      header: 'Клиент',
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col gap-px">
          <Link
            to={clientPath(row.original)}
            className="truncate text-body font-medium text-ink transition-colors duration-100 hover:text-accent"
          >
            {row.original.name}
          </Link>
          {cozy && (
            <span className="truncate text-mini text-ink-muted">
              {row.original.city} · {row.original.plan}
            </span>
          )}
        </span>
      ),
    }),

    helper.accessor('status', {
      header: 'Статус',
      cell: ({ getValue }) => <ClientStatusDot status={getValue()} />,
    }),

    helper.display({
      id: 'ledger-divider',
      header: '',
      meta: { divider: true },
    }),

    helper.accessor('employees', {
      header: 'Сотрудников',
      meta: { numeric: true, headerClassName: 'pr-2.5', cellClassName: 'pr-2.5' },
      cell: ({ getValue }) => formatNumber(getValue()),
    }),

    helper.accessor('lastActiveAt', {
      header: 'Последняя активность',
      meta: { headerClassName: 'pl-3.5', cellClassName: 'pl-3.5 text-ink-muted' },
      cell: ({ getValue }) => formatRelative(getValue()),
    }),

    helper.accessor('createdAt', {
      header: 'Создан',
      meta: { numeric: true, cellClassName: 'text-ink-muted' },
      cell: ({ getValue }) => formatDate(getValue()),
    }),

    helper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        // Клавиатурная навигация: без focus-within действия недостижимы без мыши
        <span className="flex justify-end gap-1 opacity-0 transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100">
          <LinkButton size="xs" to={clientPath(row.original)}>
            Открыть
          </LinkButton>
          {/* Приостановка требует причины, поэтому из списка ведём на вкладку
              доступа с раскрытой формой, а не выполняем действие на месте */}
          <LinkButton
            size="xs"
            variant="danger"
            to={`${clientPath(row.original)}/access?suspend=1`}
            aria-label={`Приостановить доступ: ${row.original.name}`}
            title="Приостановить доступ"
            className="w-6 px-0"
          >
            <span aria-hidden className="h-[9px] w-[7px] border-x-[1.5px] border-current" />
          </LinkButton>
        </span>
      ),
    }),
  ])
}
