import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ApiError } from '@/lib/http'
import { login } from './api'

/**
 * Вход — не один из восьми экранов PAGES.md, а инфраструктура под ними:
 * без него токен взять неоткуда. Оформлен минимально, тем же языком, что и
 * остальная панель (см. DESIGN_BRIEF), но без сайдбара — заходить ещё не во что.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    login(email.trim(), password)
      .then(() => void navigate('/overview', { replace: true }))
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : 'Не удалось войти. Проверьте соединение.',
        )
      })
      .finally(() => setPending(false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form
        onSubmit={onSubmit}
        className="flex w-[340px] flex-col gap-4 rounded-panel border border-line bg-surface p-6"
      >
        <div className="flex items-center gap-[9px]">
          <span aria-hidden className="size-5 shrink-0 rounded-[5px] border-[1.5px] border-accent" />
          <span className="text-body font-medium tracking-[-0.1px]">Суперадминка</span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-small text-ink-muted" htmlFor="login-email">
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              className="h-9 font-mono"
              value={email}
              invalid={error !== ''}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-small text-ink-muted" htmlFor="login-password">
              Пароль
            </label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="h-9"
              value={password}
              invalid={error !== ''}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        {error && <span className="text-mini text-danger">{error}</span>}

        <Button type="submit" variant="primary" disabled={pending} className="h-9">
          {pending ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </div>
  )
}
