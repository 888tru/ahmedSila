import {
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * Мета-настройки колонки. `numeric` включает «учётный» вид: моноширинный
 * шрифт с табличными цифрами и выравнивание по правому краю.
 */
export interface ClientColumnMeta {
  numeric?: boolean
  /** Колонка-разделитель шириной 1px — линия учётной сетки, а не данные. */
  divider?: boolean
  headerClassName?: string
  cellClassName?: string
}

/*
  В v9 фичи таблицы подключаются явно: всё, что не перечислено здесь, в
  инстансе просто отсутствует. Сейчас нужна только пагинация — сортировка и
  скрытие колонок добавляются сюда же, когда до них дойдёт дело.
*/
export const clientsTableFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: {} as ClientColumnMeta,
})

export type ClientsTableFeatures = typeof clientsTableFeatures
