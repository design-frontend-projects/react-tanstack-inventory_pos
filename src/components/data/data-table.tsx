'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'

// Generic enterprise data table. Wraps the hand-rolled `<table>` convention used
// across inventory/purchasing into one reusable, sortable, paginated component.

export type SortDirection = 'asc' | 'desc'

export interface DataTableColumn<TRow> {
  id: string
  header: React.ReactNode
  // Cell renderer. Receives the whole row so cells can compose derived values.
  cell: (row: TRow) => React.ReactNode
  // Optional accessor used for client-side sorting. Return a string or number.
  sortValue?: (row: TRow) => string | number
  align?: 'start' | 'end' | 'center'
  // Tailwind width/utility classes for the column header + cells.
  className?: string
  headerClassName?: string
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
}

const alignClass: Record<NonNullable<DataTableColumn<unknown>['align']>, string> =
  {
    start: 'text-start',
    end: 'text-end',
    center: 'text-center',
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
}: DataTableProps<TRow>) {
  const [sort, setSort] = React.useState<{ id: string; dir: SortDirection } | null>(
    null,
  )
  const [page, setPage] = React.useState(0)

  const sortedRows = React.useMemo(() => {
    if (!sort) {
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
  }, [rows, sort, columns])

  const totalPages = pageSize ? Math.ceil(sortedRows.length / pageSize) : 1
  const pagedRows = React.useMemo(() => {
    if (!pageSize) {
      return sortedRows
    }
    const start = page * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  // Reset to the first page whenever the underlying data shrinks past the cursor.
  React.useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1))
    }
  }, [page, totalPages])

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

  if (isError) {
    return (
      <WorkspaceEmptyState
        title="Unable to load"
        description={errorMessage}
        className="border-destructive/30 bg-destructive/[0.04]"
      />
    )
  }

  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (sortedRows.length === 0) {
    return (
      <WorkspaceEmptyState
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      >
        {emptyChildren}
      </WorkspaceEmptyState>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead
            className={cn(
              stickyHeader && 'sticky top-0 z-10 bg-card',
            )}
          >
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {columns.map((column) => {
                const sortDir =
                  sort && sort.id === column.id ? sort.dir : null
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
            {pagedRows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-b border-border/70 last:border-0',
                  onRowClick &&
                    'cursor-pointer transition-colors hover:bg-muted/50',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
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
            ))}
          </tbody>
        </table>
      </div>

      {pageSize && totalPages > 1 ? (
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
