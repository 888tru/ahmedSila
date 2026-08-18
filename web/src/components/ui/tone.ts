export type Tone = 'ok' | 'warn' | 'danger' | 'muted' | 'accent'

export const DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  muted: 'bg-ink-muted',
  accent: 'bg-accent',
}
