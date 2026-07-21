import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataTable, buildCsv } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  documentStatusTone,
  formatDocumentStatus,
} from '#/components/documents/document-status-flow'
import {
  createEmptyLine,
  validateLines,
} from '#/components/documents/line-items-editor'
import type { DocumentLine } from '#/components/documents/line-items-editor'

afterEach(() => {
  cleanup()
})

interface Row {
  id: string
  name: string
  qty: number
}

const columns: DataTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: (row) => row.name,
    sortValue: (row) => row.name,
  },
  {
    id: 'qty',
    header: 'Qty',
    align: 'end',
    cell: (row) => row.qty,
    sortValue: (row) => row.qty,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: () => 'edit',
  },
]

const rows: Row[] = [
  { id: '1', name: 'Burger', qty: 5 },
  { id: '2', name: 'Avocado toast', qty: 12 },
]

describe('buildCsv', () => {
  it('exports only columns that expose a text accessor', () => {
    const csv = buildCsv(columns, rows)

    // The "Actions" column has neither exportValue nor sortValue, so it is skipped.
    expect(csv.split('\n')[0]).toBe('Name,Qty')
    expect(csv).toContain('Burger,5')
    expect(csv).toContain('Avocado toast,12')
  })

  it('prefers exportValue over sortValue', () => {
    const csv = buildCsv(
      [
        {
          id: 'name',
          header: 'Name',
          cell: (row: Row) => row.name,
          sortValue: (row: Row) => row.name,
          exportValue: (row: Row) => row.name.toUpperCase(),
        },
      ],
      rows,
    )

    expect(csv).toContain('BURGER')
  })

  it('quotes cells containing commas, quotes, or newlines', () => {
    const csv = buildCsv(
      [
        {
          id: 'name',
          header: 'Name',
          cell: (row: Row) => row.name,
          exportValue: (row: Row) => row.name,
        },
      ],
      [{ id: '1', name: 'Fries, large "combo"', qty: 1 }],
    )

    expect(csv).toContain('"Fries, large ""combo"""')
  })
})

describe('DataTable selection', () => {
  it('reports the row keys that were toggled on', () => {
    const onChange = vi.fn()

    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        selection={{ selectedIds: [], onChange }}
      />,
    )

    const checkboxes = screen.getAllByLabelText('Select row')
    fireEvent.click(checkboxes[0])

    expect(onChange).toHaveBeenCalledWith(['1'])
  })

  it('selects every row on the page from the header checkbox', () => {
    const onChange = vi.fn()

    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        selection={{ selectedIds: [], onChange }}
      />,
    )

    fireEvent.click(screen.getByLabelText('Select all rows on this page'))

    expect(onChange).toHaveBeenCalledWith(['1', '2'])
  })

  it('surfaces a bulk action bar once rows are selected', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        selection={{
          selectedIds: ['1'],
          onChange: vi.fn(),
          bulkActions: <button type="button">Archive</button>,
        }}
      />,
    )

    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.getByText('Archive')).toBeTruthy()
  })
})

describe('DataTable server pagination', () => {
  it('reports the server range and pages through callbacks', () => {
    const onPageChange = vi.fn()

    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        pagination={{
          mode: 'server',
          page: 0,
          pageSize: 2,
          total: 6,
          onPageChange,
        }}
      />,
    )

    expect(screen.getByText(/1–2/)).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeTruthy()

    fireEvent.click(screen.getByText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})

describe('document status helpers', () => {
  it('maps lifecycle states to a consistent tone', () => {
    expect(documentStatusTone('DRAFT')).toBe('neutral')
    expect(documentStatusTone('approved')).toBe('success')
    expect(documentStatusTone('IN_TRANSIT')).toBe('info')
    expect(documentStatusTone('CANCELLED')).toBe('danger')
  })

  it('falls back to neutral for unknown or missing states', () => {
    expect(documentStatusTone('SOMETHING_NEW')).toBe('neutral')
    expect(documentStatusTone(null)).toBe('neutral')
  })

  it('renders enum values as human labels', () => {
    expect(formatDocumentStatus('PARTIALLY_RECEIVED')).toBe(
      'Partially Received',
    )
    expect(formatDocumentStatus(null)).toBe('Unknown')
  })
})

describe('validateLines', () => {
  function line(overrides: Partial<DocumentLine> = {}): DocumentLine {
    return {
      ...createEmptyLine(),
      productId: 'p1',
      quantity: '3',
      ...overrides,
    }
  }

  it('accepts a complete line', () => {
    expect(validateLines([line()])).toEqual({})
  })

  it('requires a product and a positive quantity', () => {
    const missingProduct = line({ productId: '' })
    const zeroQty = line({ quantity: '0' })

    expect(
      validateLines([missingProduct])[missingProduct.key].productId,
    ).toBeTruthy()
    expect(validateLines([zeroQty])[zeroQty.key].quantity).toBeTruthy()
  })

  it('enforces extra required fields such as uom and location', () => {
    const target = line()
    const errors = validateLines([target], {
      requiredFields: ['uomId', 'toLocationId'],
    })

    expect(errors[target.key].uomId).toBeTruthy()
    expect(errors[target.key].toLocationId).toBeTruthy()
  })

  it('enforces unit cost only when the document requires it', () => {
    const target = line()

    expect(validateLines([target])).toEqual({})
    expect(
      validateLines([target], { requireUnitCost: true })[target.key].unitCost,
    ).toBeTruthy()
  })
})
