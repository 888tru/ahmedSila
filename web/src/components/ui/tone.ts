export type Tone = 'ok' | 'warn' | 'danger' | 'muted'

export const DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  muted: 'bg-ink-muted',
}
