/*
  Форматирование дат и чисел для интерфейса.

  API отдаёт время в ISO/UTC — человекочитаемый вид собирается здесь, а не на
  бэкенде: иначе строку «12 минут назад» пришлось бы пересчитывать на каждом
  запросе и локализовать в двух местах.
*/

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const numberFmt = new Intl.NumberFormat('ru-RU')

const relativeFmt = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' })

const pluralRules = new Intl.PluralRules('ru-RU')

/** Дата в виде 14.02.2026 — колонка «Создан». */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

/** Дата со временем — 14.08.2026, 11:42. Журнал, переписка, отметки времени. */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

export function formatNumber(value: number): string {
  return numberFmt.format(value)
}

/**
 * Изменение показателя к предыдущему периоду: «+4», «−3», «0».
 * Минус типографский (U+2212), а не дефис: в ряду моноширинных цифр дефис
 * читается как перенос, а не как знак.
 */
export function formatDelta(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`
  if (value < 0) return `−${formatNumber(-value)}`
  return '0'
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

/**
 * «12 минут назад», «вчера», «3 месяца назад» — колонка «Последняя активность».
 * До минуты округляем вверх до «только что»: секундная точность здесь не несёт
 * смысла, а дёргающееся значение мешает читать таблицу.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 60) return 'только что'

  for (const [unit, size] of UNITS) {
    if (abs >= size) {
      return relativeFmt.format(Math.round(seconds / size), unit)
    }
  }
  return 'только что'
}

/**
 * Разбирает дату в формате «14.08.2026» (обратная операция к `formatDate`) —
 * поля «с»/«по» в произвольном периоде журнала действий. `null` на пустой
 * строке и на всём, что не похоже на дату: фильтр по такому полю просто не
 * применяется, а не падает на невалидном вводе.
 */
export function parseRuDate(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Русская плюрализация: plural('клиент', 'клиента', 'клиентов').
 * Intl.PluralRules сам разбирает случай 11–14, руками это регулярно ломают.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  switch (pluralRules.select(count)) {
    case 'one':
      return one
    case 'few':
      return few
    default:
      return many
  }
}
