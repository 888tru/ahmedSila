import { useEffect, useRef, useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { TEMPLATE_PREVIEW_SAMPLE, TEMPLATE_VARS, type Settings } from './types'
import { useSaveMessageTemplate, useSettings } from './useSettings'

const PLAN_COLUMNS = '150px 1px 130px 130px minmax(220px,1fr)'

function renderPreview(text: string): string {
  return TEMPLATE_VARS.reduce(
    (result, token) => result.split(token).join(TEMPLATE_PREVIEW_SAMPLE[token]),
    text,
  )
}

export function SettingsPage() {
  const { data, isError, refetch } = useSettings()
  const saveTemplate = useSaveMessageTemplate()

  const [text, setText] = useState('')
  // Локальный текст заводим один раз, когда данные пришли — иначе фоновый
  // рефетч затирал бы то, что человек уже успел напечатать.
  const seeded = useRef(false)
  useEffect(() => {
    if (data && !seeded.current) {
      setText(data.template.text)
      seeded.current = true
    }
  }, [data])

  const dirty = !!data && text !== data.template.text

  return (
    <AppShell active="settings" breadcrumbs={[{ label: 'Суперадминка' }, { label: 'Настройки' }]}>
      <div className="flex min-w-0 max-w-[840px] flex-col gap-4 px-5 pt-5 pb-10">
        <div className="flex flex-col gap-[3px]">
          <h1 className="text-title font-medium tracking-[-0.2px]">Настройки</h1>
          <span className="text-tiny text-ink-muted">Тарифные планы и шаблоны сообщений клиентам</span>
        </div>

        {isError ? (
          <div className="rounded-panel border border-line bg-surface">
            <ErrorState onRetry={() => void refetch()} />
          </div>
        ) : !data ? (
          <>
            <Panel title="Тарифные планы" hint="справочно · меняются при изменении бизнес-условий">
              <PlansSkeleton />
            </Panel>
            <Panel title="Шаблоны сообщений" hint="уходит клиенту вместе с кодом подтверждения">
              <div className="flex flex-col gap-2.5 px-[15px] py-3.5">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-3 w-64" />
              </div>
            </Panel>
          </>
        ) : (
          <>
            <Panel
              title="Тарифные планы"
              hint="справочно · меняются при изменении бизнес-условий"
            >
              <PlansTable plans={data.plans} />
              <div className="px-[15px] py-[11px]">
                <span className="text-mini leading-normal text-ink-muted">
                  Эти же описания показываются подсказкой под выбором тарифа в форме создания
                  клиента.
                </span>
              </div>
            </Panel>

            <Panel title="Шаблоны сообщений" hint="уходит клиенту вместе с кодом подтверждения">
                <div className="flex flex-col gap-2.5 px-[15px] py-3.5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-small font-medium">Сообщение с кодом подтверждения</span>
                    <Textarea
                      rows={7}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      className="leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-mini text-ink-muted">Подстановки</span>
                    {TEMPLATE_VARS.map((token) => (
                      <span
                        key={token}
                        className="rounded-[4px] border border-line bg-canvas px-1.5 py-0.5 font-mono text-mini"
                      >
                        {token}
                      </span>
                    ))}
                    <span className="text-mini text-ink-muted">
                      подставляются автоматически при отправке
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-control border border-line bg-canvas px-3 py-2.5">
                    <span className="text-mini text-ink-muted">Предпросмотр</span>
                    <span className="text-small leading-relaxed whitespace-pre-wrap">
                      {renderPreview(text)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!dirty || saveTemplate.isPending}
                      onClick={() => saveTemplate.mutate(text)}
                    >
                      Сохранить
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setText(data.template.defaultText)}
                    >
                      Вернуть исходный текст
                    </Button>
                    {!dirty && data.template.updatedAt && (
                      <span className="text-mini text-ink-muted">
                        Сохранено {formatDateTime(data.template.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  )
}

function PlansTable({ plans }: { plans: Settings['plans'] }) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid h-8 min-w-[660px] items-center border-b border-line-soft px-[15px]"
        style={{ gridTemplateColumns: PLAN_COLUMNS }}
      >
        <span className="pr-3 text-micro font-medium text-ink-muted">Тариф</span>
        <span aria-hidden className="h-8 self-stretch bg-line-soft" />
        <span className="px-3 text-right text-micro font-medium text-ink-muted">Сотрудников</span>
        <span className="pr-3.5 text-right text-micro font-medium text-ink-muted">Цена, ₸/мес</span>
        <span className="text-micro font-medium text-ink-muted">Что входит</span>
      </div>
      {plans.map((plan) => (
        <div
          key={plan.key}
          className="grid min-h-11 min-w-[660px] items-center gap-y-1 border-b border-line-soft px-[15px] py-2"
          style={{ gridTemplateColumns: PLAN_COLUMNS }}
        >
          <span className="flex items-center gap-2 pr-3 text-small font-medium">
            <span
              aria-hidden
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                plan.key === 'Starter' ? 'bg-ink-muted' : 'bg-accent',
              )}
            />
            {plan.key}
          </span>
          <span aria-hidden className="self-stretch bg-line-soft" />
          <span className="px-3 text-right font-mono text-small">{plan.limit}</span>
          <span className="pr-3.5 text-right font-mono text-small">{plan.price}</span>
          <span className="text-small leading-snug text-ink-muted">{plan.includes}</span>
        </div>
      ))}
    </div>
  )
}

function PlansSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 px-[15px] py-3.5">
      {Array.from({ length: 3 }, (_, row) => (
        <Skeleton key={row} className="h-3 w-full" />
      ))}
    </div>
  )
}
