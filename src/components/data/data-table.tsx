'use client'

import * as React from 'react'
import { Columns3Icon, DownloadIcon } from 'lucide-react'

import { cn } from '#/lib/utils'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

// Generic enterprise data table. Wraps the hand-rolled `<table>` convention used
// across inventory/purchasing into one reusable, sortable, paginated component.
// Column visibility, row selection, CSV export and server-side pagination are
// opt-in: omit the props and the component behaves exactly as before.

export type SortDirection = 'asc' | 'desc'

export interface DataTableColumn<TRow> {
  id: string
  header: React.ReactNode
  // Cell renderer. Receives the whole row so cells can compose derived values.
  cell: (row: TRow) => React.ReactNode
  // Optional accessor used for client-side sorting. Return a string or number.
  sortValue?: (row: TRow) => string | number
  // Plain-text accessor used for CSV export. Falls back to `sortValue`.
  exportValue?: (row: TRow) => string | number
  align?: 'start' | 'end' | 'center'
  // Tailwind width/utility classes for the column header + cells.
  className?: string
  headerClassName?: string
  // Hidden until the user enables it from the column chooser.
  defaultHidden?: boolean
  // Excluded from the column chooser (always visible).
  alwaysVisible?: boolean
}

export interface DataTableSelection {
  selectedIds: Array<string>
  onChange: (ids: Array<string>) => void
  // Rendered in a bar above the table whenever at least one row is selected.
  bulkActions?: React.ReactNode
}

export interface DataTableServerPagination {
  mode: 'server'
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[]
  rows: TRow[]
  rowKey: (row: TRow) => string
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyChildren?: React.ReactNode
  onRowClick?: (row: TRow) => void
  // Enables the built-in client-side pager. Omit to render every row.
  pageSize?: number
  className?: string
  // Sticky header for tall scroll regions.
  stickyHeader?: boolean
  // Opt-in toolbar capabilities.
  enableColumnVisibility?: boolean
  selection?: DataTableSelection
  // Providing a filename renders the CSV export button.
  exportFileName?: string
  // Switches the pager to server-driven mode (skips client slicing).
  pagination?: DataTableServerPagination
  // Extra toolbar content rendered before the built-in controls.
  toolbarChildren?: React.ReactNode
}

const alignClass: Record<
  NonNullable<DataTableColumn<unknown>['align']>,
  string
> = {
  start: 'text-start',
  end: 'text-end',
  center: 'text-center',
}

function escapeCsvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function headerToText(header: React.ReactNode, fallback: string): string {
  return typeof header === 'string' || typeof header === 'number'
    ? String(header)
    : fallback
}

export function buildCsv<TRow>(
  columns: DataTableColumn<TRow>[],
  rows: TRow[],
): string {
  const exportable = columns.filter((col) => col.exportValue ?? col.sortValue)
  const head = exportable
    .map((col) => escapeCsvCell(headerToText(col.header, col.id)))
    .join(',')
  const body = rows.map((row) =>
    exportable
      .map((col) => {
        const accessor = col.exportValue ?? col.sortValue
        return escapeCsvCell(accessor ? accessor(row) : '')
      })
      .join(','),
  )
  return [head, ...body].join('\n')
}

function downloadCsv(fileName: string, csv: string): void {
  if (typeof document === 'undefined') {
    return
  }
  // Prepend a BOM so Excel reads UTF-8 (Arabic tenant data) correctly.
  const blob = new Blob([String.fromCharCode(0xfeff), csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  isError = false,
  errorMessage = 'Something went wrong while loading this table.',
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'No records match the current view.',
  emptyChildren,
  onRowClick,
  pageSize,
  className,
  stickyHeader = false,
  enableColumnVisibility = false,
  selection,
  exportFileName,
  pagination,
  toolbarChildren,
}: DataTableProps<TRow>) {
  const [sort, setSort] = React.useState<{
    id: string
    dir: SortDirection
  } | null>(null)
  const [page, setPage] = React.useState(0)
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(
    () =>
      new Set(columns.filter((col) => col.defaultHidden).map((col) => col.id)),
  )

  const isServerPaginated = pagination?.mode === 'server'

  const visibleColumns = React.useMemo(
    () => columns.filter((col) => !hiddenColumns.has(col.id)),
    [columns, hiddenColumns],
  )

  const sortedRows = React.useMemo(() => {
    // Server-paginated tables sort server-side; the client slice would only
    // reorder the current page and mislead the user.
    if (!sort || isServerPaginated) {
      return rows
    }
    const column = columns.find((col) => col.id === sort.id)
    if (!column?.sortValue) {
      return rows
    }
    const accessor = column.sortValue
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * factor
      }
      return String(av).localeCompare(String(bv)) * factor
    })
  }, [rows, sort, columns, isServerPaginated])

  const totalPages = isServerPaginated
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : pageSize
      ? Math.ceil(sortedRows.length / pageSize)
      : 1

  const pagedRows = React.useMemo(() => {
    if (isServerPaginated || !pageSize) {
      return sortedRows
    }
    const start = page * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize, isServerPaginated])

  // Reset to the first page whenever the underlying data shrinks past the cursor.
  React.useEffect(() => {
    if (!isServerPaginated && page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages, isServerPaginated])

  function toggleSort(column: DataTableColumn<TRow>) {
    if (!column.sortValue) {
      return
    }
    setSort((current) => {
      if (!current || current.id !== column.id) {
        return { id: column.id, dir: 'asc' }
      }
      if (current.dir === 'asc') {
        return { id: column.id, dir: 'desc' }
      }
      return null
    })
  }

  const selectedSet = React.useMemo(
    () => new Set(selection?.selectedIds ?? []),
    [selection?.selectedIds],
  )
  const pageKeys = React.useMemo(
    () => pagedRows.map((row) => rowKey(row)),
    [pagedRows, rowKey],
  )
  const allPageSelected =
    pageKeys.length > 0 && pageKeys.every((key) => selectedSet.has(key))
  const somePageSelected = pageKeys.some((key) => selectedSet.has(key))

  function toggleAllOnPage(checked: boolean) {
    if (!selection) {
      return
    }
    const next = new Set(selectedSet)
    for (const key of pageKeys) {
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
    }
    selection.onChange([...next])
  }

  function toggleRow(key: string, checked: boolean) {
    if (!selection) {
      return
    }
    const next = new Set(selectedSet)
    if (checked) {
      next.add(key)
    } else {
      next.delete(key)
    }
    selection.onChange([...next])
  }

  const hasToolbar = Boolean(
    toolbarChildren || enableColumnVisibility || exportFileName,
  )

  const toolbar = hasToolbar ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {toolbarChildren}
      {enableColumnVisibility ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Columns3Icon />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns
              .filter((col) => !col.alwaysVisible)
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={!hiddenColumns.has(col.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    setHiddenColumns((current) => {
                      const next = new Set(current)
                      if (checked) {
                        next.delete(col.id)
                      } else {
                        next.add(col.id)
                      }
                      return next
                    })
                  }
                >
                  {headerToText(col.header, col.id)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {exportFileName ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sortedRows.length === 0}
          onClick={() =>
            downloadCsv(exportFileName, buildCsv(visibleColumns, sortedRows))
          }
        >
          <DownloadIcon />
          Export
        </Button>
      ) : null}
    </div>
  ) : null

  if (isError) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {toolbar}
        <WorkspaceEmptyState
          title="Unable to load"
          description={errorMessage}
          className="border-destructive/30 bg-destructive/4"
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {toolbar}
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (sortedRows.length === 0) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {toolbar}
        <WorkspaceEmptyState title={emptyTitle} description={emptyDescription}>
          {emptyChildren}
        </WorkspaceEmptyState>
      </div>
    )
  }

  const selectedCount = selectedSet.size

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {toolbar}

      {selection && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/6 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">
            {selection.bulkActions}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => selection.onChange([])}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-xl border-collapse text-sm">
          <thead className={cn(stickyHeader && 'sticky top-0 z-10 bg-card')}>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {selection ? (
                <th scope="col" className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label="Select all rows on this page"
                    checked={
                      allPageSelected
                        ? true
                        : somePageSelected
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(checked) =>
                      toggleAllOnPage(checked === true)
                    }
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => {
                const sortDir = sort && sort.id === column.id ? sort.dir : null
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      'px-3 py-2 font-semibold',
                      column.align && alignClass[column.align],
                      column.sortValue && 'cursor-pointer select-none',
                      column.headerClassName,
                    )}
                    aria-sort={
                      sortDir
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : column.sortValue
                          ? 'none'
                          : undefined
                    }
                    onClick={() => toggleSort(column)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.header}
                      {column.sortValue ? (
                        <span aria-hidden className="text-[0.7em]">
                          {sortDir ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      ) : null}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => {
              const key = rowKey(row)
              return (
                <tr
                  key={key}
                  data-selected={selectedSet.has(key) || undefined}
                  className={cn(
                    'border-b border-border/70 last:border-0 data-selected:bg-primary/4',
                    onRowClick &&
                      'cursor-pointer transition-colors hover:bg-muted/50',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selection ? (
                    <td
                      className="w-10 px-3 py-2.5 align-middle"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        aria-label="Select row"
                        checked={selectedSet.has(key)}
                        onCheckedChange={(checked) =>
                          toggleRow(key, checked === true)
                        }
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        'px-3 py-2.5 align-middle',
                        column.align && alignClass[column.align],
                        column.align === 'end' && 'tabular-nums',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isServerPaginated ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {pagination.page * pagination.pageSize + 1}–
            {Math.min(
              (pagination.page + 1) * pagination.pageSize,
              pagination.total,
            )}{' '}
            of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page === 0}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Prev
            </Button>
            <span className="tabular-nums">
              {pagination.page + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages - 1}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : pageSize && totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, sortedRows.length)} of{' '}
            {sortedRows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Prev
            </Button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
