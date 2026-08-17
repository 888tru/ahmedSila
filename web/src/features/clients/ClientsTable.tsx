import type { ReactTable } from '@tanstack/react-table'

import { Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import type { ClientsTableFeatures } from './table'
import type { Client } from './types'

/** Высота строки: компактно — 34px, комфортно — 48px (бриф: 32–36px по умолчанию). */
const ROW_HEIGHT = { compact: 'h-[34px]', cozy: 'h-12' } as const

interface ClientsTableProps {
  table: ReactTable<ClientsTableFeatures, Client>
  cozy: boolean
}

export function ClientsTable({ table, cozy }: ClientsTableProps) {
  const rowHeight = cozy ? ROW_HEIGHT.cozy : ROW_HEIGHT.compact

  return (
    <>
      {table.getHeaderGroups().map((headerGroup) => (
        <div
          key={headerGroup.id}
          role="row"
          className="ledger-grid sticky top-0 z-10 h-[34px] border-b border-line bg-surface px-3.5"
        >
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta
            if (meta?.divider) {
              return <span key={header.id} aria-hidden className="self-stretch bg-line" />
            }
            return (
              <span
                key={header.id}
                role="columnheader"
                className={cn(
                  'text-micro font-medium tracking-[0.02em] text-ink-muted',
                  meta?.numeric && 'text-right',
                  meta?.headerClassName,
                )}
              >
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </span>
            )
          })}
        </div>
      ))}

      {table.getRowModel().rows.map((row) => (
        <div
          key={row.id}
          role="row"
          className={cn(
            'ledger-grid group border-b border-line-soft bg-surface px-3.5',
            'transition-colors duration-100 hover:bg-surface-hover',
            rowHeight,
          )}
        >
          {row.getAllCells().map((cell) => {
            const meta = cell.column.columnDef.meta
            if (meta?.divider) {
              return <span key={cell.id} aria-hidden className="self-stretch bg-line-soft" />
            }
            return (
              <span
                key={cell.id}
                role="cell"
                className={cn(
                  'min-w-0 text-body',
                  meta?.numeric && 'text-right font-mono',
                  meta?.cellClassName,
                )}
              >
                <table.FlexRender cell={cell} />
              </span>
            )
          })}
        </div>
      ))}
    </>
  )
}

/** Скелетон в форме будущей таблицы: те же колонки и та же высота строки. */
export function ClientsTableSkeleton({ rows = 8, cozy }: { rows?: number; cozy: boolean }) {
  const rowHeight = cozy ? ROW_HEIGHT.cozy : ROW_HEIGHT.compact
  // По одной записи на колонку `.ledger-grid`: 'divider' — та самая линия
  // учётной сетки, 'none' — колонка действий, в загрузке она пустая.
  const cells = [
    'w-40',
    'w-16',
    'divider',
    'w-8 justify-self-end',
    'w-24',
    'w-16 justify-self-end',
    'none',
  ]

  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          aria-hidden
          className={cn('ledger-grid border-b border-line-soft bg-surface px-3.5', rowHeight)}
        >
          {cells.map((cell, cellIndex) => {
            if (cell === 'divider') {
              return <span key={cellIndex} className="self-stretch bg-line-soft" />
            }
            if (cell === 'none') {
              return <span key={cellIndex} />
            }
            return <Skeleton key={cellIndex} className={cn('h-3', cell)} />
          })}
        </div>
      ))}
    </>
  )
}
