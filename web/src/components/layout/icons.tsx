import type { SVGProps } from 'react'

/*
  Иконки — контурные, 16×16, толщина 1.5, цвет наследуется от текста пункта
  меню. Никакой заливки и цвета: в сайдбаре иконка помогает найти строку
  взглядом, но не должна конкурировать с единственным акцентом интерфейса.
*/

function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

/** Обзор — сводка из блоков. */
export function IconOverview(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Glyph>
  )
}

/** Клиенты — магазин. */
export function IconClients(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M3 6.5v7h10v-7" />
      <path d="M2 6.5 3.6 2.5h8.8L14 6.5" />
      <path d="M6.5 13.5v-4h3v4" />
    </Glyph>
  )
}

/** Обращения — переписка. */
export function IconTickets(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M13.5 10.5a1 1 0 0 1-1 1H6l-3 2.5v-2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h9.5a1 1 0 0 1 1 1z" />
    </Glyph>
  )
}

/** Журнал действий — записи с отметками. */
export function IconAudit(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M2.5 4h1.5M6.5 4h7M2.5 8h1.5M6.5 8h7M2.5 12h1.5M6.5 12h7" />
    </Glyph>
  )
}

/** Команда — сотрудники. */
export function IconTeam(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5" />
      <path d="M11 3.4a2.5 2.5 0 0 1 0 4.7M12.4 10.4c1.3.5 2.1 1.6 2.1 3.1" />
    </Glyph>
  )
}

/** Настройки — регулировки. */
export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M2.5 5h4M9.5 5h4M2.5 11h1M6.5 11h7" />
      <circle cx="8" cy="5" r="1.6" />
      <circle cx="4.8" cy="11" r="1.6" />
    </Glyph>
  )
}

/** Стрелка сворачивания сайдбара. */
export function IconCollapse(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M9.5 4 5.5 8l4 4" />
    </Glyph>
  )
}
