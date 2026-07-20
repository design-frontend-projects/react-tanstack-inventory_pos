import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterTabs } from '#/components/data/filter-bar'
import { FormWizard } from '#/components/forms/form-wizard'
import { KanbanBoard } from '#/components/board/kanban-board'
import { StatusChip } from '#/components/board/status-chip'

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
]

const rows: Row[] = [
  { id: '1', name: 'Burger', qty: 5 },
  { id: '2', name: 'Avocado toast', qty: 12 },
  { id: '3', name: 'Chicken wrap', qty: 2 },
]

describe('DataTable', () => {
  it('renders rows and sorts by a column on header click', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />)

    const cells = () =>
      screen.getAllByRole('row').slice(1).map((row) => row.textContent)

    // Unsorted keeps input order.
    expect(cells()[0]).toContain('Burger')

    fireEvent.click(screen.getByText('Name'))
    expect(cells()[0]).toContain('Avocado toast')

    // Second click flips direction.
    fireEvent.click(screen.getByText('Name'))
    expect(cells()[0]).toContain('Chicken wrap')

    // Third click clears sorting back to input order.
    fireEvent.click(screen.getByText('Name'))
    expect(cells()[0]).toContain('Burger')
  })

  it('paginates rows and pages forward', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        pageSize={2}
      />,
    )

    expect(screen.getAllByRole('row')).toHaveLength(1 + 2)
    expect(screen.getByText('1–2 of 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('3–3 of 3')).toBeTruthy()
    expect(screen.getByText('Chicken wrap')).toBeTruthy()
  })

  it('renders the empty state when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        emptyTitle="No items"
        emptyDescription="Nothing matched."
      />,
    )
    expect(screen.getByText('No items')).toBeTruthy()
  })

  it('fires onRowClick with the clicked row', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    )
    fireEvent.click(screen.getByText('Burger'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })
})

describe('FilterTabs', () => {
  it('marks the active tab and emits changes', () => {
    const onChange = vi.fn()
    render(
      <FilterTabs
        tabs={[
          { value: 'all', label: 'All', count: 3 },
          { value: 'open', label: 'Open' },
        ]}
        value="all"
        onChange={onChange}
      />,
    )

    const active = screen.getByRole('tab', { selected: true })
    expect(active.textContent).toContain('All')

    fireEvent.click(screen.getByRole('tab', { name: 'Open' }))
    expect(onChange).toHaveBeenCalledWith('open')
  })
})

describe('FormWizard', () => {
  const steps = [
    { id: 'a', title: 'Details', validate: () => null },
    { id: 'b', title: 'Guests', validate: (): string | null => 'Add a guest' },
    { id: 'c', title: 'Review' },
  ]

  it('advances through valid steps and blocks on validation errors', () => {
    const onComplete = vi.fn()
    render(
      <FormWizard
        steps={steps}
        renderStep={(step) => <p>Body: {step.title}</p>}
        onComplete={onComplete}
      />,
    )

    expect(screen.getByText('Body: Details')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Body: Guests')).toBeTruthy()

    // Step B always fails validation — advancing shows the error and stays.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Add a guest')).toBeTruthy()
    expect(screen.getByText('Body: Guests')).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('completes from the last step', () => {
    const onComplete = vi.fn()
    render(
      <FormWizard
        steps={[steps[0], steps[2]]}
        renderStep={(step) => <p>Body: {step.title}</p>}
        onComplete={onComplete}
        completeLabel="Book"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Book' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('lets the user revisit completed steps via the progress rail', () => {
    render(
      <FormWizard
        steps={[steps[0], steps[2]]}
        renderStep={(step) => <p>Body: {step.title}</p>}
        onComplete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Body: Review')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(screen.getByText('Body: Details')).toBeTruthy()
  })
})

describe('KanbanBoard', () => {
  const boardColumns = [
    { id: 'new', title: 'New' },
    { id: 'ready', title: 'Ready' },
  ]
  const cards = [
    { id: 'c1', columnId: 'new', label: 'Order #1' },
    { id: 'c2', columnId: 'ready', label: 'Order #2' },
  ]

  it('groups cards into their columns', () => {
    render(
      <KanbanBoard
        columns={boardColumns}
        cards={cards}
        renderCard={(card) => <article>{card.label}</article>}
      />,
    )
    expect(screen.getByText('Order #1')).toBeTruthy()
    expect(screen.getByText('Order #2')).toBeTruthy()
  })

  it('fires onCardMove when a card is dropped on another column', () => {
    const onCardMove = vi.fn()
    render(
      <KanbanBoard
        columns={boardColumns}
        cards={cards}
        renderCard={(card) => <article>{card.label}</article>}
        onCardMove={onCardMove}
      />,
    )

    const card = screen.getByText('Order #1').parentElement as HTMLElement
    const readyColumn = screen.getByText('Ready').closest('section') as HTMLElement

    fireEvent.dragStart(card)
    fireEvent.dragOver(readyColumn)
    fireEvent.drop(readyColumn)

    expect(onCardMove).toHaveBeenCalledWith('c1', 'ready')
  })
})

describe('StatusChip', () => {
  it('renders its content', () => {
    render(<StatusChip tone="success">Ready</StatusChip>)
    expect(screen.getByText('Ready')).toBeTruthy()
  })
})
