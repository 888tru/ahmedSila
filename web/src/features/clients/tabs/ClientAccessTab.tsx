import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { DefinitionList, Panel } from '@/components/ui/Panel'
import { ClientStatusDot } from '@/components/ui/StatusDot'
import { Skeleton } from '@/components/ui/States'
import { formatDate } from '@/lib/format'
import {
  useClient,
  useDeleteClient,
  useIssueActivationCode,
  useResumeClient,
  useSuspendClient,
} from '../useClients'

interface ClientAccessTabProps {
  clientId: string
  /** Пришли сюда из кнопки «Приостановить доступ» — форму причины сразу раскрыть. */
  suspendRequested: boolean
}

export function ClientAccessTab({ clientId, suspendRequested }: ClientAccessTabProps) {
  const client = useClient(clientId).data

  if (!client) {
    return (
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Panel title="Подписка">
          <div className="flex flex-col gap-3.5 p-[15px]">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-36" />
          </div>
        </Panel>
        <Panel title="Доступ">
          <div className="flex flex-col gap-3.5 p-[15px]">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-3 w-full" />
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Panel title="Подписка">
        <DefinitionList
          labelWidth="130px"
          items={[
            { label: 'Тариф', value: client.plan },
            {
              label: 'Дата начала',
              value: <span className="font-mono">{formatDate(client.createdAt)}</span>,
            },
            { label: 'Статус', value: <ClientStatusDot status={client.status} /> },
          ]}
        />
      </Panel>

      <AccessPanel
        clientId={clientId}
        paused={client.status === 'paused'}
        suspendedReason={client.suspendedReason}
        activationCode={client.activationCode}
        suspendRequested={suspendRequested}
      />

      <DangerPanel clientId={clientId} clientName={client.name} />
    </div>
  )
}

interface AccessPanelProps {
  clientId: string
  paused: boolean
  suspendedReason?: string
  activationCode?: { code: string; expiresAt: string }
  suspendRequested: boolean
}

function AccessPanel({
  clientId,
  paused,
  suspendedReason,
  activationCode,
  suspendRequested,
}: AccessPanelProps) {
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(suspendRequested)
  const [reason, setReason] = useState('')
  const [reasonMissing, setReasonMissing] = useState(false)
  const [copied, setCopied] = useState(false)

  const issueCode = useIssueActivationCode(clientId)
  const suspend = useSuspendClient(clientId)
  const resume = useResumeClient(clientId)

  const closeForm = () => {
    setFormOpen(false)
    setReason('')
    setReasonMissing(false)
    // Убираем `?suspend=1`, иначе форма снова раскроется при возврате назад
    void navigate(`/clients/${clientId}/access`, { replace: true })
  }

  const onSuspend = () => {
    if (reason.trim() === '') {
      setReasonMissing(true)
      return
    }
    suspend.mutate(reason.trim(), { onSuccess: closeForm })
  }

  const onCopy = () => {
    if (!activationCode) return
    void navigator.clipboard.writeText(activationCode.code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Panel title="Доступ">
      <div className="flex flex-col gap-3 px-[15px] py-3.5">
        <section className="flex flex-col gap-1.5">
          <Button
            size="sm"
            className="self-start"
            disabled={issueCode.isPending}
            onClick={() => issueCode.mutate(undefined)}
          >
            Сгенерировать новый код подтверждения
          </Button>
          <span className="text-mini leading-normal text-ink-muted">
            Нужен, если старый код не использовали или клиент потерял доступ. Код одноразовый,
            действует 7 дней.
          </span>

          {activationCode && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-control border border-line bg-canvas px-[11px] py-[9px]">
              {/* Код диктуют по телефону — крупно, моно, с разрядкой */}
              <span className="font-mono text-[16px] font-medium tracking-[0.05em]">
                {activationCode.code}
              </span>
              <span className="text-mini text-ink-muted">
                действует до{' '}
                <span className="font-mono">{formatDate(activationCode.expiresAt)}</span>
              </span>
              <Button size="xs" className="ml-auto" onClick={onCopy}>
                {copied ? 'Скопировано' : 'Скопировать'}
              </Button>
            </div>
          )}
        </section>

        <span aria-hidden className="h-px bg-line-soft" />

        <section className="flex flex-col gap-1.5">
          <Button
            size="sm"
            className="self-start"
            disabled={suspend.isPending || resume.isPending}
            onClick={() => (paused ? resume.mutate(undefined) : setFormOpen(true))}
          >
            {paused ? 'Возобновить доступ' : 'Приостановить доступ'}
          </Button>
          <span className="text-mini leading-normal text-ink-muted">
            {paused
              ? `Сотрудники клиента снова смогут входить в систему.${
                  suspendedReason ? ` Причина приостановки: ${suspendedReason.toLowerCase()}.` : ''
                }`
              : 'Сотрудники клиента перестанут входить в систему. Нужно указать причину.'}
          </span>

          {!paused && formOpen && (
            <div className="flex flex-col gap-[7px] rounded-control border border-line bg-canvas p-[11px]">
              <label className="text-tiny font-medium" htmlFor="suspend-reason">
                Причина приостановки
              </label>
              <Input
                id="suspend-reason"
                value={reason}
                invalid={reasonMissing}
                placeholder="Например, просрочка оплаты"
                onChange={(event) => {
                  setReason(event.target.value)
                  setReasonMissing(false)
                }}
              />
              {reasonMissing && (
                <span className="text-mini text-danger">
                  Укажите причину — она попадёт в журнал действий
                </span>
              )}
              <div className="flex gap-[7px]">
                <Button
                  variant="primary"
                  size="sm"
                  className="h-7 text-tiny"
                  disabled={suspend.isPending}
                  onClick={onSuspend}
                >
                  Приостановить
                </Button>
                <Button size="sm" className="h-7 text-tiny" onClick={closeForm}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Panel>
  )
}

function DangerPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typedName, setTypedName] = useState('')
  // Возвращаться в карточку удалённого клиента некуда, поэтому replace
  const remove = useDeleteClient(clientId, () => void navigate('/clients', { replace: true }))

  // Подтверждение — точное совпадение названия: единственная защита от того,
  // чтобы удалить не того клиента, восстановить данные нельзя
  const canDelete = typedName.trim() === clientName

  return (
    <Panel title="Необратимые действия" className="mt-1.5 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-4 px-[15px] py-3.5">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-small font-medium">Удалить клиента</span>
          <span className="text-mini leading-normal text-ink-muted">
            Клиент и его сотрудники потеряют доступ, данные восстановить нельзя.
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setTypedName('')
            setConfirmOpen(true)
          }}
        >
          Удалить клиента
        </Button>
      </div>

      {confirmOpen && (
        <Modal
          title="Удалить клиента"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                disabled={!canDelete || remove.isPending}
                onClick={() => canDelete && remove.mutate(undefined)}
              >
                Удалить клиента
              </Button>
              <Button size="sm" className="h-8" onClick={() => setConfirmOpen(false)}>
                Отмена
              </Button>
            </>
          }
        >
          <span className="text-small leading-relaxed text-ink-muted">
            Будут удалены все данные клиента, его сотрудники потеряют доступ, обращения и журнал
            действий останутся только в общем архиве. Действие необратимо.
          </span>
          <div className="flex flex-col gap-1.5">
            <label className="text-tiny" htmlFor="confirm-client-name">
              Введите название клиента полностью: <span className="font-medium">{clientName}</span>
            </label>
            <Input
              id="confirm-client-name"
              className="h-8"
              value={typedName}
              placeholder={clientName}
              onChange={(event) => setTypedName(event.target.value)}
            />
          </div>
        </Modal>
      )}
    </Panel>
  )
}
