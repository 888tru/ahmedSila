import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { ChoiceGroup } from '@/components/ui/ChoiceGroup'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PLANS, type ClientDetail, type ClientPlan } from './types'
import { useCreateClient, useEmailTaken } from './useClients'

interface FieldSpec {
  key: FieldKey
  label: string
  placeholder: string
  /** Номера и адреса почты читают по символам — им моноширинный шрифт. */
  mono?: boolean
  hint?: string
}

type FieldKey = 'name' | 'address' | 'ownerName' | 'phone' | 'email'

const FIELDS: readonly FieldSpec[] = [
  { key: 'name', label: 'Название магазина', placeholder: 'Например, Береке Супермаркет' },
  { key: 'address', label: 'Город и адрес', placeholder: 'Шымкент, ул. Байтурсынова 41' },
  { key: 'ownerName', label: 'Владелец (ФИО)', placeholder: 'Ержан Сапаров' },
  {
    key: 'phone',
    label: 'Телефон',
    placeholder: '+7 701 000 00 00',
    mono: true,
    hint: 'На этот номер отправим код в WhatsApp',
  },
  { key: 'email', label: 'Email', placeholder: 'owner@example.kz', mono: true },
]

const EMPTY: Record<FieldKey, string> = {
  name: '',
  address: '',
  ownerName: '',
  phone: '',
  email: '',
}

const STATUS_CHOICES = [
  { value: 'trial' as const, label: 'Начать с пробного периода' },
  { value: 'active' as const, label: 'Активировать сразу' },
]

const PLAN_CHOICES = PLANS.map((plan) => ({ value: plan.key, label: plan.key }))

const DEFAULT_TRIAL_DAYS = '14'

/**
 * Проверка одного поля. Форматом занимаемся здесь, занятостью email — запросом
 * к бэкенду (см. `useEmailTaken`): существование чужой учётки на клиенте не
 * узнать.
 */
function validate(key: FieldKey, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return 'Заполните поле'
  if (key === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return 'Проверьте адрес: похоже, в нём опечатка'
  }
  // 11 цифр — минимум для номера с кодом страны (+7 701 244 18 03)
  if (key === 'phone' && trimmed.replace(/\D/g, '').length < 11) {
    return 'Укажите номер полностью, с кодом страны'
  }
  return ''
}

/**
 * Создание клиента (PAGES.md §4): форма, а после сохранения — код подтверждения
 * для первого входа владельца.
 *
 * Отдельный экран, а не модалка: полей шесть, у половины есть подсказки и
 * ошибки на месте, и на созданного клиента нужно уметь дать ссылку из чата
 * поддержки.
 */
export function NewClientPage() {
  const navigate = useNavigate()

  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [plan, setPlan] = useState<ClientPlan>('Growth')
  const [start, setStart] = useState<'trial' | 'active'>('trial')
  const [trialDays, setTrialDays] = useState(DEFAULT_TRIAL_DAYS)

  const create = useCreateClient()

  // Спрашиваем бэкенд, только когда адрес дописан до правдоподобного вида:
  // иначе запрос уходил бы на каждую букву.
  const email = values.email.trim().toLowerCase()
  const emailTaken = useEmailTaken(validate('email', email) === '' ? email : '')

  const errorOf = (key: FieldKey): string => {
    const error = validate(key, values[key])
    if (error) return error
    if (key === 'email' && emailTaken.data === true) {
      return 'Этот email уже используется другим клиентом'
    }
    return ''
  }

  const days = Number(trialDays)
  const trialError =
    start === 'trial' && (!Number.isInteger(days) || days < 1 || days > 365)
      ? 'Пробный период — от 1 до 365 дней'
      : ''

  const hasErrors = FIELDS.some((field) => errorOf(field.key) !== '') || trialError !== ''
  const checkingEmail = emailTaken.isFetching

  const onSubmit = () => {
    setSubmitted(true)
    // Пока проверка email не вернулась, отправлять рано: иначе форма уедет на
    // бэкенд и вернётся оттуда с той же ошибкой, но уже без подсветки поля.
    if (hasErrors || checkingEmail) return
    create.mutate({
      name: values.name.trim(),
      address: values.address.trim(),
      ownerName: values.ownerName.trim(),
      phone: values.phone.trim(),
      email,
      plan,
      trialDays: start === 'trial' ? days : 0,
    })
  }

  const resetForm = () => {
    setValues(EMPTY)
    setTouched({})
    setSubmitted(false)
    setPlan('Growth')
    setStart('trial')
    setTrialDays(DEFAULT_TRIAL_DAYS)
    create.reset()
  }

  const created = create.data

  // Молча ничего не делать по нажатию нельзя: у кнопки должен быть либо
  // результат, либо объяснение, почему его пока нет. Ожидание проверки email —
  // не ошибка пользователя, поэтому оно приглушённое, а не красное.
  const footer: { text: string; muted?: boolean } | null = create.isError
    ? { text: 'Не удалось создать клиента. Проверьте соединение и попробуйте снова' }
    : submitted && hasErrors
      ? { text: 'Заполните обязательные поля' }
      : submitted && checkingEmail
        ? { text: 'Проверяем email, секунду', muted: true }
        : null

  return (
    <AppShell
      active="clients"
      breadcrumbs={[
        { label: 'Суперадминка' },
        { label: 'Клиенты', to: '/clients' },
        { label: 'Новый клиент' },
      ]}
    >
      <div className="flex min-w-0 max-w-[720px] flex-col gap-3.5 px-5 pt-5 pb-10">
        <div className="flex flex-col gap-[3px]">
          <h1 className="text-title font-medium tracking-[-0.2px]">Создать клиента</h1>
          <span className="text-tiny text-ink-muted">
            После сохранения вы получите код подтверждения для первого входа владельца
          </span>
        </div>

        <Panel title="Данные магазина">
          <div className="flex flex-col py-1">
            {FIELDS.map((field) => {
              const error = touched[field.key] || submitted ? errorOf(field.key) : ''
              return (
                <FormRow key={field.key} label={field.label} htmlFor={`new-client-${field.key}`}>
                  <Input
                    id={`new-client-${field.key}`}
                    className={cn('h-8', field.mono && 'font-mono')}
                    value={values[field.key]}
                    invalid={error !== ''}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setValues((state) => ({ ...state, [field.key]: event.target.value }))
                    }
                    onBlur={() => setTouched((state) => ({ ...state, [field.key]: true }))}
                  />
                  {error ? (
                    <span className="text-mini text-danger">{error}</span>
                  ) : (
                    field.hint && <span className="text-mini text-ink-muted">{field.hint}</span>
                  )}
                </FormRow>
              )
            })}

            <FormRow label="Тариф">
              <ChoiceGroup label="Тариф" options={PLAN_CHOICES} value={plan} onChange={setPlan} />
              <span className="text-mini text-ink-muted">
                {PLANS.find((item) => item.key === plan)?.hint}
              </span>
            </FormRow>

            <FormRow label="Статус при создании" className="border-t border-line-soft">
              <div className="flex flex-wrap items-center gap-2.5">
                <ChoiceGroup
                  label="Статус при создании"
                  options={STATUS_CHOICES}
                  value={start}
                  onChange={setStart}
                />
                {start === 'trial' && (
                  <div className="flex items-center gap-2">
                    <label className="text-small text-ink-muted" htmlFor="new-client-trial-days">
                      Длительность триала, дней
                    </label>
                    <Input
                      id="new-client-trial-days"
                      inputMode="numeric"
                      className="h-[30px] w-16 text-right font-mono"
                      value={trialDays}
                      invalid={submitted && trialError !== ''}
                      onChange={(event) =>
                        setTrialDays(event.target.value.replace(/\D/g, '').slice(0, 3))
                      }
                    />
                  </div>
                )}
              </div>
              {start === 'active' ? (
                <span className="text-mini text-ink-muted">
                  Клиент сразу получит статус «Активен», без пробного периода
                </span>
              ) : (
                submitted &&
                trialError && <span className="text-mini text-danger">{trialError}</span>
              )}
            </FormRow>
          </div>

          <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
            <Button variant="primary" disabled={create.isPending} onClick={onSubmit}>
              Создать клиента
            </Button>
            <Button size="sm" onClick={() => void navigate('/clients')}>
              Отмена
            </Button>
            {footer && (
              <span
                className={cn(
                  'ml-auto text-right text-mini',
                  footer.muted ? 'text-ink-muted' : 'text-danger',
                )}
              >
                {footer.text}
              </span>
            )}
          </div>
        </Panel>
      </div>

      {created && (
        <ActivationCodeModal
          client={created}
          onGoToClient={() => void navigate(`/clients/${created.id}`)}
          onCreateAnother={resetForm}
        />
      )}
    </AppShell>
  )
}

/**
 * Строка формы: подпись слева фиксированной колонкой, поле и всё, что под ним
 * (ошибка или подсказка) — справа. Подписи выстроены в одну вертикаль, поэтому
 * форма читается сверху вниз одним движением глаз.
 */
function FormRow({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  /** Без него подпись — не `<label>`: у группы кнопок нет одного поля, к которому её привязать. */
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  const labelClassName = 'pt-[7px] text-small text-ink-muted'
  return (
    <div
      className={cn('grid items-start gap-3.5 px-4 py-[9px]', className)}
      style={{ gridTemplateColumns: '170px minmax(0,1fr)' }}
    >
      {htmlFor ? (
        <label className={labelClassName} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className={labelClassName}>{label}</span>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  )
}

/**
 * Результат создания: код подтверждения для первого входа владельца.
 *
 * Закрытие модалки — переход в карточку клиента, а не возврат к пустой форме:
 * клиент уже создан, и код никуда не денется — карточка показывает его на
 * вкладке «Доступ и подписка», пока владелец им не воспользовался.
 */
function ActivationCodeModal({
  client,
  onGoToClient,
  onCreateAnother,
}: {
  client: ClientDetail
  onGoToClient: () => void
  onCreateAnother: () => void
}) {
  const [copied, setCopied] = useState(false)
  const activation = client.activationCode

  const onCopy = () => {
    if (!activation) return
    void navigator.clipboard.writeText(activation.code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  // Код диктуют по телефону или пересылают в мессенджер — второй способ
  // надёжнее, поэтому текст собираем целиком, а не только код.
  const onSendToWhatsApp = () => {
    if (!activation) return
    const text =
      `Код для первого входа в систему: ${activation.code}. ` +
      `Действует до ${formatDate(activation.expiresAt)}.`
    window.open(
      `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    )
  }

  return (
    <Modal
      title="Клиент создан"
      tone="ok"
      onClose={onGoToClient}
      footer={
        <>
          <Button variant="primary" size="sm" className="h-8" onClick={onGoToClient}>
            Перейти к клиенту
          </Button>
          <Button size="sm" className="h-8" onClick={onCreateAnother}>
            Создать ещё одного
          </Button>
        </>
      }
    >
      <span className="text-small leading-relaxed text-ink-muted">
        Передайте код владельцу — <span className="text-ink">{client.ownerName}</span> — для первого
        входа в систему.
      </span>

      {activation && (
        <>
          <div className="flex flex-col items-center gap-[7px] rounded-panel border border-line bg-canvas px-4 py-[18px]">
            <span className="font-mono text-[30px] leading-tight font-medium tracking-[0.06em]">
              {activation.code}
            </span>
            <span className="text-mini text-ink-muted">
              Действует 7 дней, до{' '}
              <span className="font-mono">{formatDate(activation.expiresAt)}</span>
            </span>
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="h-8 flex-1" onClick={onCopy}>
              {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
            <Button size="sm" className="h-8 flex-1" onClick={onSendToWhatsApp}>
              Отправить в WhatsApp
            </Button>
          </div>
        </>
      )}

      <div className="flex gap-[9px] rounded-control bg-warn-soft px-3 py-[11px]">
        <span aria-hidden className="mt-1.5 size-[5px] shrink-0 rounded-full bg-warn" />
        <span className="text-mini leading-relaxed text-warn">
          Код одноразовый. Если владелец не успел войти за 7 дней, откройте карточку клиента и
          сгенерируйте новый код.
        </span>
      </div>
    </Modal>
  )
}
