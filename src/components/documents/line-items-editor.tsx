'use client'

import { PlusIcon, Trash2Icon } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { fieldInputClassName } from '#/components/forms/drawer-form'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'

// Editable line grid shared by every document create/edit form (requisition,
// purchase order, goods receipt, return, adjustment, transfer, stock count).
// Lines are updated immutably — the parent owns the array and passes it back in.

export interface LineItemOption {
  value: string
  label: string
}

export interface DocumentLine {
  // Stable client-side key; document ids are assigned server-side on save.
  key: string
  productId: string
  quantity: string
  unitCost?: string
  note?: string
  [extra: string]: string | undefined
}

export interface LineItemColumnConfig {
  unitCost?: boolean
  note?: boolean
  // Label overrides for domain-specific wording (e.g. "Counted qty").
  quantityLabel?: string
  unitCostLabel?: string
}

// Additional per-line dropdowns required by specific document schemas — unit of
// measure on every document, destination location on goods receipts, source
// location on returns.
export interface LineItemSelectConfig {
  field: string
  label: string
  options: LineItemOption[]
  required?: boolean
  placeholder?: string
}

export function createEmptyLine(): DocumentLine {
  return {
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    productId: '',
    quantity: '',
    unitCost: '',
    note: '',
  }
}

export function LineItemsEditor({
  lines,
  onChange,
  products,
  columns = {},
  selects = [],
  errors = {},
  disabled = false,
  addLabel = 'Add line',
  emptyDescription = 'Add at least one line before saving this document.',
  className,
}: {
  lines: DocumentLine[]
  onChange: (lines: DocumentLine[]) => void
  products: LineItemOption[]
  columns?: LineItemColumnConfig
  selects?: LineItemSelectConfig[]
  // Keyed by line key, then field name.
  errors?: Record<string, Partial<Record<string, string>>>
  disabled?: boolean
  addLabel?: string
  emptyDescription?: string
  className?: string
}) {
  const showUnitCost = columns.unitCost ?? true
  const showNote = columns.note ?? false

  function updateLine(key: string, field: string, value: string) {
    onChange(
      lines.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    )
  }

  function removeLine(key: string) {
    onChange(lines.filter((line) => line.key !== key))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {lines.length === 0 ? (
        <WorkspaceEmptyState
          title="No lines yet"
          description={emptyDescription}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const lineErrors = errors[line.key] ?? {}
            return (
              <div
                key={line.key}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2 pb-2">
                  <span className="ops-panel-label">Line {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove line ${index + 1}`}
                    disabled={disabled}
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Product
                    </span>
                    <select
                      className={fieldInputClassName}
                      value={line.productId}
                      disabled={disabled}
                      aria-invalid={Boolean(lineErrors.productId)}
                      onChange={(event) =>
                        updateLine(line.key, 'productId', event.target.value)
                      }
                    >
                      <option value="">Select a product…</option>
                      {products.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {lineErrors.productId ? (
                      <span className="text-xs text-destructive">
                        {lineErrors.productId}
                      </span>
                    ) : null}
                  </label>

                  {selects.map((select) => (
                    <label key={select.field} className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {select.label}
                      </span>
                      <select
                        className={fieldInputClassName}
                        value={line[select.field] ?? ''}
                        disabled={disabled}
                        aria-invalid={Boolean(lineErrors[select.field])}
                        onChange={(event) =>
                          updateLine(line.key, select.field, event.target.value)
                        }
                      >
                        <option value="">
                          {select.placeholder ??
                            `Select ${select.label.toLowerCase()}…`}
                        </option>
                        {select.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {lineErrors[select.field] ? (
                        <span className="text-xs text-destructive">
                          {lineErrors[select.field]}
                        </span>
                      ) : null}
                    </label>
                  ))}

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {columns.quantityLabel ?? 'Quantity'}
                    </span>
                    <input
                      className={fieldInputClassName}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={line.quantity}
                      disabled={disabled}
                      aria-invalid={Boolean(lineErrors.quantity)}
                      onChange={(event) =>
                        updateLine(line.key, 'quantity', event.target.value)
                      }
                    />
                    {lineErrors.quantity ? (
                      <span className="text-xs text-destructive">
                        {lineErrors.quantity}
                      </span>
                    ) : null}
                  </label>

                  {showUnitCost ? (
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {columns.unitCostLabel ?? 'Unit cost'}
                      </span>
                      <input
                        className={fieldInputClassName}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={line.unitCost ?? ''}
                        disabled={disabled}
                        aria-invalid={Boolean(lineErrors.unitCost)}
                        onChange={(event) =>
                          updateLine(line.key, 'unitCost', event.target.value)
                        }
                      />
                      {lineErrors.unitCost ? (
                        <span className="text-xs text-destructive">
                          {lineErrors.unitCost}
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  {showNote ? (
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Note
                      </span>
                      <input
                        className={fieldInputClassName}
                        value={line.note ?? ''}
                        disabled={disabled}
                        onChange={(event) =>
                          updateLine(line.key, 'note', event.target.value)
                        }
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={() => onChange([...lines, createEmptyLine()])}
      >
        <PlusIcon />
        {addLabel}
      </Button>
    </div>
  )
}

// Shared line validation used by the document create forms before submitting.
export function validateLines(
  lines: DocumentLine[],
  options: { requireUnitCost?: boolean; requiredFields?: Array<string> } = {},
): Record<string, Partial<Record<string, string>>> {
  const errors: Record<string, Partial<Record<string, string>>> = {}

  for (const line of lines) {
    const lineErrors: Partial<Record<string, string>> = {}

    if (!line.productId) {
      lineErrors.productId = 'Select a product.'
    }

    for (const field of options.requiredFields ?? []) {
      if (!line[field]) {
        lineErrors[field] = 'This field is required.'
      }
    }

    const quantity = Number(line.quantity)
    if (!line.quantity || Number.isNaN(quantity) || quantity <= 0) {
      lineErrors.quantity = 'Enter a quantity greater than zero.'
    }

    if (options.requireUnitCost) {
      const unitCost = Number(line.unitCost)
      if (!line.unitCost || Number.isNaN(unitCost) || unitCost < 0) {
        lineErrors.unitCost = 'Enter a valid unit cost.'
      }
    }

    if (Object.keys(lineErrors).length > 0) {
      errors[line.key] = lineErrors
    }
  }

  return errors
}
