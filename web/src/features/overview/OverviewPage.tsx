import { Link, useNavigate } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { LinkButton } from '@/components/ui/Button'
import { Metrics } from '@/components/ui/Metrics'
import { Panel } from '@/components/ui/Panel'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, plural } from '@/lib/format'
import { METRIC_LABEL, type ExpiringTrial, type OverviewEvent, type OverviewEventKind } from './types'
import { useOverview } from './useOverview'

/*
  Шапка и строки внутри панели обязаны использовать одну и ту же сетку — иначе
  колонки разъедутся. Тот же принцип, что у `.ledger-grid` в index.css: колонка
  шириной 1px между текстовой и числовой частью строки — это самостоятельная
  колонка грида, а не бордер ячейки, поэтому линия непрерывна.
*/
const TRIALS_COLUMNS = 'minmax(0,1fr) 1px 92px 110px'
// 140px, а не 132: «17.08.2026, 12:24» моноширинным в 12px не помещается в
// 132px вместе с отбивкой и переносится на вторую строку.
const EVENTS_COLUMNS = '140px 1px minmax(0,1fr)'

/** Ширины ячеек скелетона по колонкам; `null` — колонка-линейка. */
const TRIALS_SKELETON = ['w-40', null, 'w-12', 'w-16'] as const
const EVENTS_SKELETON = ['w-24', null, 'w-full'] as const

/** Тип события влияет только на цвет точки — текст приходит готовым. */
const EVENT_DOT: Record<OverviewEventKind, string> = {
  client_created: 'bg-accent',
  ticket_opened: 'bg-warn',
  access_paused: 'bg-danger',
  client_activated: 'bg-ok',
  other: 'bg-ink-muted',
}

/**
 * Стартовый экран после входа (PAGES.md §1): общая картина по всем клиентам —
 * показатели с дельтой к предыдущему периоду, кому скоро заканчивать триал и
 * что произошло за последние дни.
 */
export function OverviewPage() {
  const navigate = useNavigate()
  const { data, isPending, isError, refetch, dataUpdatedAt } = useOverview()

  const isEmpty = data?.totalClients === 0

  return (
    <AppShell active="overview" breadcrumbs={[{ label: 'Суперадминка' }, { label: 'Обзор' }]}>
      <div className="flex min-w-0 flex-col gap-3.5 px-5 pt-5 pb-8">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-[3px]">
            <h1 className="text-title font-medium tracking-[-0.2px]">Обзор</h1>
            <span className="text-tiny text-ink-muted">
              {isPending
                ? 'Загружаем данные'
                : isEmpty
                  ? 'Клиентов пока нет'
                  : data
                    ? `Данные за ${data.periodDays} ${plural(data.periodDays, 'день', 'дня', 'дней')} · обновлено ${formatDateTime(new Date(dataUpdatedAt).toISOString())}`
                    : 'Не удалось загрузить данные'}
            </span>
          </div>
          <LinkButton variant="primary" className="ml-auto" to="/clients/new">
            + Клиент
          </LinkButton>
        </div>

        {isError ? (
          <div className="rounded-panel border border-line bg-surface">
            <ErrorState onRetry={() => void refetch()} />
          </div>
        ) : isEmpty ? (
          <div className="rounded-panel border border-line bg-surface py-5">
            <EmptyState
              title="Добавьте первого клиента, чтобы увидеть статистику"
              hint="Метрики, триалы и события появятся здесь, как только в системе будет хотя бы один клиент."
              ctaLabel="Создать клиента"
              onCta={() => void navigate('/clients/new')}
            />
          </div>
        ) : (
          <>
            <Metrics
              size="lg"
              loading={isPending}
              cells={(data?.metrics ?? PLACEHOLDER_METRICS).map((metric) => ({
                label: METRIC_LABEL[metric.key],
                value: metric.value,
                delta: metric.delta,
              }))}
            />

            <div
              className="grid items-start gap-3.5"
              style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(440px,1fr))' }}
            >
              <Panel
                title="Триал заканчивается скоро"
                hint="нужно связаться"
                action={<PanelLink to="/clients?status=trial">Все триалы</PanelLink>}
              >
                {isPending ? (
                  <SkeletonRows columns={TRIALS_COLUMNS} widths={TRIALS_SKELETON} count={5} />
                ) : data && data.expiringTrials.length > 0 ? (
                  <>
                    <div
                      className="grid h-[30px] items-center border-b border-line-soft px-[15px]"
                      style={{ gridTemplateColumns: TRIALS_COLUMNS }}
                    >
                      <ColumnHeader className="pr-3.5">Клиент</ColumnHeader>
                      <span aria-hidden className="w-px self-stretch bg-line" />
                      <ColumnHeader className="pr-2.5 text-right">Осталось</ColumnHeader>
                      <ColumnHeader className="text-right">Дата окончания</ColumnHeader>
                    </div>
                    {data.expiringTrials.map((trial) => (
                      <TrialRow key={trial.clientId} trial={trial} />
                    ))}
                  </>
                ) : (
                  <PanelPlaceholder>Ближайших окончаний триала нет</PanelPlaceholder>
                )}
              </Panel>

              <Panel
                title="Последние события"
                /* Общего журнала действий ещё нет (PAGES.md §6) — ссылке некуда вести */
                action={<PanelLink>Журнал действий</PanelLink>}
              >
                {isPending ? (
                  <SkeletonRows columns={EVENTS_COLUMNS} widths={EVENTS_SKELETON} count={7} />
                ) : data && data.events.length > 0 ? (
                  data.events.map((event) => <EventRow key={event.id} event={event} />)
                ) : (
                  <PanelPlaceholder>Событий пока нет</PanelPlaceholder>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

/** Каркас строки показателей на время загрузки — числа рисует сам `Metrics`. */
const PLACEHOLDER_METRICS = [
  { key: 'activeClients', value: 0, delta: null },
  { key: 'trialClients', value: 0, delta: null },
  { key: 'openTickets', value: 0, delta: null },
  { key: 'pausedClients', value: 0, delta: null },
] as const

function TrialRow({ trial }: { trial: ExpiringTrial }) {
  return (
    <div
      className="grid h-9 items-center border-b border-line-soft px-[15px] transition-colors duration-100 hover:bg-surface-hover"
      style={{ gridTemplateColumns: TRIALS_COLUMNS }}
    >
      <div className="flex min-w-0 items-center gap-2 pr-3.5">
        {/* Триал — предупреждение, а не ошибка: цвет тот же, что у статуса в таблице */}
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warn" />
        <Link
          to={`/clients/${trial.clientId}`}
          className="truncate text-small text-ink transition-colors duration-100 hover:text-accent"
        >
          {trial.name}
        </Link>
      </div>
      <span aria-hidden className="w-px self-stretch bg-line-soft" />
      <span className="pr-2.5 text-right font-mono text-small">{formatDaysLeft(trial.endsAt)}</span>
      <span className="text-right font-mono text-small text-ink-muted">
        {formatDate(trial.endsAt)}
      </span>
    </div>
  )
}

function EventRow({ event }: { event: OverviewEvent }) {
  return (
    <div
      className="grid min-h-9 items-center border-b border-line-soft px-[15px]"
      style={{ gridTemplateColumns: EVENTS_COLUMNS }}
    >
      <span className="pr-3 font-mono text-tiny whitespace-nowrap text-ink-muted">
        {formatDateTime(event.occurredAt)}
      </span>
      <span aria-hidden className="w-px self-stretch bg-line-soft" />
      <div className="flex min-w-0 items-center gap-2 py-2 pl-3.5">
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', EVENT_DOT[event.kind])} />
        <span className="text-small leading-snug">{event.text}</span>
      </div>
    </div>
  )
}

function ColumnHeader({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-micro font-medium text-ink-muted', className)}>{children}</span>
}

/** Ссылка «смотреть всё» в шапке панели. Без `to` — экрана ещё нет. */
function PanelLink({ to, children }: { to?: string; children: string }) {
  if (!to) {
    return (
      <span aria-disabled className="text-mini text-ink-muted">
        {children}
      </span>
    )
  }
  return (
    <Link to={to} className="text-mini text-accent transition-colors duration-100 hover:text-accent-hover">
      {children}
    </Link>
  )
}

/** Панель без строк: сообщаем, что данных нет, но панель не убираем. */
function PanelPlaceholder({ children }: { children: string }) {
  return (
    <div className="px-[15px] py-8 text-center text-small text-ink-muted">{children}</div>
  )
}

/**
 * Скелетон в форме будущего контента, а не спиннер (PAGES.md, общие состояния).
 * `widths` описывает ячейки строки по порядку колонок; `null` — колонка-линейка
 * шириной 1px, в ней рисовать нечего.
 */
function SkeletonRows({
  columns,
  widths,
  count,
}: {
  columns: string
  widths: ReadonlyArray<string | null>
  count: number
}) {
  return (
    <>
      {Array.from({ length: count }, (_, row) => (
        <div
          key={row}
          className="grid h-9 items-center gap-3.5 border-b border-line-soft px-[15px]"
          style={{ gridTemplateColumns: columns }}
        >
          {widths.map((width, cell) =>
            width ? (
              <Skeleton key={cell} className={cn('h-3', width)} />
            ) : (
              <span key={cell} />
            ),
          )}
        </div>
      ))}
    </>
  )
}

/**
 * «Осталось» — целые дни до конца триала. Округляем вверх: пока не наступила
 * дата окончания, у клиента есть день, и «0 дней» на действующем триале
 * читалось бы как «уже всё».
 */
function formatDaysLeft(endsAt: string): string {
  const days = Math.ceil((new Date(endsAt).getTime() - Date.now()) / (24 * 60 * 60_000))
  if (days <= 0) return 'сегодня'
  return `${days} ${plural(days, 'день', 'дня', 'дней')}`
}
