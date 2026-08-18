import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { FilterChip } from '@/components/ui/FilterChip'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDateTime, parseRuDate, plural } from '@/lib/format'
import { ASSIGNEES } from '@/features/tickets/types'
import {
  KIND_LABEL,
  KIND_ORDER,
  KIND_TONE,
  type GlobalJournalEntry,
  type JournalActorFilter,
  type JournalKindFilter,
  type JournalPeriod,
} from './types'
import { useJournal } from './useJournal'

/*
  «Журнал действий» (PAGES.md §6) — только просмотр, ни одного действия по
  строке: команда смотрит сюда, чтобы понять, кто что сделал, а не чтобы что-то
  поменять. Тот же принцип, что у вкладки журнала в карточке клиента.
*/

const ROW_COLUMNS = '150px 130px 1px minmax(320px,1fr) 190px'
const SKELETON_COLUMNS = ['w-24', 'w-20', null, 'w-80', 'w-24'] as const

const PERIODS: ReadonlyArray<{ key: JournalPeriod; label: string }> = [
  { key: '7', label: '7 дней' },
  { key: '30', label: '30 дней' },
  { key: 'custom', label: 'Произвольный' },
]

export function JournalPage() {
  const { data, isPending, isError, refetch } = useJournal()
  const [actor, setActor] = useState<JournalActorFilter>('all')
  const [kind, setKind] = useState<JournalKindFilter>('all')
  const [period, setPeriod] = useState<JournalPeriod>('7')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const entries = useMemo(() => data ?? [], [data])

  const withinPeriod = (entry: GlobalJournalEntry): boolean => {
    const occurred = new Date(entry.occurredAt).getTime()
    if (period === '7' || period === '30') {
      const days = period === '7' ? 7 : 30
      return occurred >= Date.now() - days * 24 * 60 * 60_000
    }
    // Произвольный период: поле, которое не удалось разобрать, границу не задаёт.
    const fromDate = parseRuDate(from)
    const toDate = parseRuDate(to)
    if (fromDate && occurred < fromDate.getTime()) return false
    if (toDate && occurred > toDate.getTime() + 24 * 60 * 60_000 - 1) return false
    return true
  }

  const filtered = entries.filter(
    (entry) =>
      (actor === 'all' || entry.actor === actor) &&
      (kind === 'all' || entry.kind === kind) &&
      withinPeriod(entry),
  )

  const isEmpty = !isPending && !isError && entries.length === 0
  const showEmptyFiltered = !isPending && !isError && !isEmpty && filtered.length === 0

  const resetFilters = () => {
    setActor('all')
    setKind('all')
    setPeriod('7')
    setFrom('')
    setTo('')
  }

  return (
    <AppShell active="audit" breadcrumbs={[{ label: 'Суперадминка' }, { label: 'Журнал действий' }]}>
      <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-5 pb-8">
        <div className="flex flex-col gap-[3px]">
          <h1 className="text-title font-medium tracking-[-0.2px]">Журнал действий</h1>
          <span className="text-tiny text-ink-muted">
            {isPending
              ? 'Загружаем журнал'
              : isEmpty
                ? 'Все действия команды по клиентам собираются здесь'
                : `${filtered.length} ${plural(filtered.length, 'запись', 'записи', 'записей')} · только просмотр`}
          </span>
        </div>

        {!isPending && !isError && !isEmpty && (
          <div className="flex flex-col gap-2">
            <FilterRow label="Сотрудник">
              <FilterChip label="Все" selected={actor === 'all'} onClick={() => setActor('all')} />
              {ASSIGNEES.map((name) => (
                <FilterChip key={name} label={name} selected={actor === name} onClick={() => setActor(name)} />
              ))}
            </FilterRow>

            <FilterRow label="Действие">
              <FilterChip label="Все" selected={kind === 'all'} onClick={() => setKind('all')} />
              {KIND_ORDER.map((key) => (
                <FilterChip
                  key={key}
                  label={KIND_LABEL[key]}
                  tone={KIND_TONE[key]}
                  selected={kind === key}
                  onClick={() => setKind(key)}
                />
              ))}
            </FilterRow>

            <FilterRow label="Период">
              {PERIODS.map((item) => (
                <FilterChip
                  key={item.key}
                  label={item.label}
                  selected={period === item.key}
                  onClick={() => setPeriod(item.key)}
                />
              ))}
              {period === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    placeholder="01.08.2026"
                    className="h-7 w-[104px] font-mono text-mini"
                    aria-label="Период с"
                  />
                  <span className="text-mini text-ink-muted">—</span>
                  <Input
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="14.08.2026"
                    className="h-7 w-[104px] font-mono text-mini"
                    aria-label="Период по"
                  />
                </div>
              )}
            </FilterRow>
          </div>
        )}

        {isError ? (
          <div className="rounded-panel border border-line bg-surface">
            <ErrorState onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <ListSkeleton />
        ) : isEmpty ? (
          <div className="rounded-panel border border-line bg-surface py-5">
            <EmptyState
              title="Записей пока нет"
              hint="Здесь появятся действия команды: создание клиентов, приостановка доступа, изменения тарифов."
              ctaLabel="Обновить"
              onCta={() => void refetch()}
            />
          </div>
        ) : showEmptyFiltered ? (
          <div className="rounded-panel border border-line bg-surface py-5">
            <EmptyState
              title="Нет записей по этому фильтру"
              hint="Измените сотрудника, тип действия или период."
              ctaLabel="Сбросить фильтры"
              onCta={resetFilters}
            />
          </div>
        ) : (
          <JournalList entries={filtered} />
        )}
      </div>
    </AppShell>
  )
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-[74px] shrink-0 text-mini text-ink-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function JournalList({ entries }: { entries: readonly GlobalJournalEntry[] }) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="max-h-[calc(100vh-320px)] overflow-auto">
        <div
          className="sticky top-0 z-[1] grid h-[34px] min-w-[940px] items-center bg-surface px-[15px]"
          style={{ gridTemplateColumns: ROW_COLUMNS }}
        >
          <ColumnHeader className="pr-3">Дата и время</ColumnHeader>
          <ColumnHeader className="pr-3">Кто</ColumnHeader>
          <span aria-hidden className="h-[34px] self-stretch bg-line" />
          <ColumnHeader className="pr-3.5 pl-3.5">Что сделал</ColumnHeader>
          <ColumnHeader>Клиент</ColumnHeader>
        </div>

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid min-w-[940px] min-h-9 items-center border-t border-line-soft px-[15px] py-1.5"
            style={{ gridTemplateColumns: ROW_COLUMNS }}
          >
            <span className="pr-3 font-mono text-small text-ink-muted">
              {formatDateTime(entry.occurredAt)}
            </span>
            <span className="truncate pr-3 text-small">{entry.actor}</span>
            <span aria-hidden className="self-stretch bg-line-soft" />
            <div className="flex min-w-0 items-start gap-2 pr-3.5 pl-3.5">
              <span
                aria-hidden
                className={cn('mt-[6px] size-1.5 shrink-0 rounded-full', KIND_DOT[entry.kind])}
              />
              <span className="text-small leading-snug">{entry.text}</span>
            </div>
            <span className="min-w-0 truncate text-small">
              {entry.clientId ? (
                <Link to={`/clients/${entry.clientId}`}>{entry.clientName}</Link>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

const KIND_DOT: Record<GlobalJournalEntry['kind'], string> = {
  access: 'bg-danger',
  clients: 'bg-accent',
  subscription: 'bg-warn',
  tickets: 'bg-ok',
  team: 'bg-ink-muted',
}

function ColumnHeader({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-micro font-medium text-ink-muted', className)}>{children}</span>
}

function ListSkeleton() {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div
        className="grid h-[34px] min-w-[940px] items-center px-[15px]"
        style={{ gridTemplateColumns: ROW_COLUMNS }}
      >
        <ColumnHeader className="pr-3">Дата и время</ColumnHeader>
        <ColumnHeader className="pr-3">Кто</ColumnHeader>
        <span aria-hidden className="h-[34px] self-stretch bg-line" />
        <ColumnHeader className="pr-3.5 pl-3.5">Что сделал</ColumnHeader>
        <ColumnHeader>Клиент</ColumnHeader>
      </div>
      {Array.from({ length: 10 }, (_, row) => (
        <div
          key={row}
          className="grid min-w-[940px] h-9 items-center gap-3 border-t border-line-soft px-[15px]"
          style={{ gridTemplateColumns: ROW_COLUMNS }}
        >
          {SKELETON_COLUMNS.map((width, cell) =>
            width ? <Skeleton key={cell} className={cn('h-3', width)} /> : <span key={cell} />,
          )}
        </div>
      ))}
    </section>
  )
}
