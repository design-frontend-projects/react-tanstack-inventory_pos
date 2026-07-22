'use client'

import * as React from 'react'
import { FormWizard } from '#/components/forms/form-wizard'
import { Field, fieldInputClassName } from '#/components/forms/drawer-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import {
  IMPORT_COLUMNS,
  autoMapHeaders,
  buildImportTemplateCsv,
  productImportRowSchema,
} from '#/features/products/import/import-schema'
import { useProductImport } from '#/features/products/import/use-product-import'
import { parseCsvTable } from '#/lib/csv/parse-csv'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'
import type { WizardStep } from '#/components/forms/form-wizard'
import type {
  ProductImportField,
  ProductImportRow,
} from '#/features/products/import/import-schema'
import type { ProductImportSummary } from '#/server/inventory/product-import-service'

// CSV → products import wizard: load a file (or paste), map columns to product
// fields, review row-level validation, then import. Rows import row by row on
// the server, so valid rows land even when others fail.

const WIZARD_MAX_ROWS = 1000

type MappingState = Partial<Record<ProductImportField, string>>

interface ReviewRow {
  rowNumber: number
  sku: string
  name: string
  errors: Array<string>
  data: ProductImportRow | null
}

const STEPS: Array<Pick<WizardStep, 'id' | 'title' | 'description'>> = [
  {
    id: 'source',
    title: 'File',
    description:
      'Upload a CSV file or paste CSV text. The first row must contain column headers.',
  },
  {
    id: 'mapping',
    title: 'Map columns',
    description:
      'Match your CSV columns to product fields. SKU, name, and base UoM are required; unmapped fields are left empty.',
  },
  {
    id: 'review',
    title: 'Review',
    description:
      'Rows with problems are skipped — fix them in the file and re-import, or continue with the valid rows.',
  },
]

function downloadTemplate() {
  const blob = new Blob([buildImportTemplateCsv()], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'product-import-template.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

interface ProductImportWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductImportWizard({
  open,
  onOpenChange,
}: ProductImportWizardProps) {
  const [csvText, setCsvText] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [mapping, setMapping] = React.useState<MappingState>({})
  const [result, setResult] = React.useState<ProductImportSummary | null>(null)
  // Remounts the wizard (and its internal step index) on every open.
  const [sessionKey, setSessionKey] = React.useState(0)
  const importMutation = useProductImport()

  React.useEffect(() => {
    if (open) {
      setCsvText('')
      setFileName(null)
      setMapping({})
      setResult(null)
      setSessionKey((key) => key + 1)
    }
  }, [open])

  const table = React.useMemo(
    () => (csvText.trim() === '' ? null : parseCsvTable(csvText)),
    [csvText],
  )

  // Fresh CSV → recompute the header auto-mapping.
  React.useEffect(() => {
    setMapping(table ? autoMapHeaders(table.headers) : {})
  }, [table])

  const reviewRows = React.useMemo<Array<ReviewRow>>(() => {
    if (!table) {
      return []
    }

    const seenSkus = new Set<string>()

    return table.records.map((record, index) => {
      const raw = IMPORT_COLUMNS.reduce<
        Partial<Record<ProductImportField, string>>
      >((accumulator, column) => {
        const header = mapping[column.key]
        return header
          ? { ...accumulator, [column.key]: record[header] ?? '' }
          : accumulator
      }, {})

      const parsed = productImportRowSchema.safeParse(raw)
      const errors = parsed.success
        ? []
        : parsed.error.issues.map((issue) =>
            issue.path.length > 0
              ? `${issue.path.join('.')}: ${issue.message}`
              : issue.message,
          )

      if (parsed.success) {
        const skuKey = parsed.data.sku.toLowerCase()
        if (seenSkus.has(skuKey)) {
          errors.push('Duplicate SKU within this file.')
        } else {
          seenSkus.add(skuKey)
        }
      }

      return {
        rowNumber: index + 1,
        sku: raw.sku ?? '',
        name: raw.name ?? '',
        errors,
        data: parsed.success && errors.length === 0 ? parsed.data : null,
      }
    })
  }, [table, mapping])

  const validRows = reviewRows.filter((row) => row.data !== null)

  const steps: Array<WizardStep> = [
    {
      ...STEPS[0],
      validate: () => {
        if (!table || table.records.length === 0) {
          return 'Load a CSV with a header row and at least one data row.'
        }
        if (table.records.length > WIZARD_MAX_ROWS) {
          return `This file has ${table.records.length} rows — the import is limited to ${WIZARD_MAX_ROWS} rows per run.`
        }
        return null
      },
    },
    {
      ...STEPS[1],
      validate: () => {
        const missing = IMPORT_COLUMNS.filter(
          (column) => column.required && !mapping[column.key],
        )
        return missing.length > 0
          ? `Map the required fields: ${missing.map((column) => column.label).join(', ')}.`
          : null
      },
    },
    {
      ...STEPS[2],
      validate: () =>
        validRows.length === 0
          ? 'No valid rows to import — fix the issues listed below.'
          : null,
    },
  ]

  async function runImport() {
    try {
      const summary = await importMutation.mutateAsync(
        validRows.map((row) => row.data as ProductImportRow),
      )
      setResult(summary)
      notifySuccess(
        'Import finished',
        `${summary.created} created · ${summary.skipped} skipped · ${summary.failed} failed.`,
      )
    } catch (error: unknown) {
      notifyError(error, 'Import failed')
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) {
      return
    }
    setFileName(file.name)
    file
      .text()
      .then(setCsvText)
      .catch((error: unknown) => notifyError(error, 'Could not read the file'))
  }

  function renderSourceStep() {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              Choose CSV file…
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            Download template
          </Button>
          {fileName ? (
            <span className="text-xs text-muted-foreground">{fileName}</span>
          ) : null}
        </div>
        <Field label="Or paste CSV text">
          <Textarea
            value={csvText}
            onChange={(event) => {
              setFileName(null)
              setCsvText(event.target.value)
            }}
            rows={8}
            placeholder={
              'SKU,Name,Base UoM code\nSKU-0001,Espresso Beans 1kg,PCS'
            }
            className="font-mono text-xs"
          />
        </Field>
        {table ? (
          <p className="text-sm text-muted-foreground">
            Detected {table.headers.length} columns and {table.records.length}{' '}
            data rows.
          </p>
        ) : null}
      </div>
    )
  }

  function renderMappingStep() {
    if (!table) {
      return null
    }

    return (
      <div className="grid max-h-80 grid-cols-1 gap-x-4 gap-y-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {IMPORT_COLUMNS.map((column) => (
          <label
            key={column.key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate">
              {column.label}
              {column.required ? (
                <span className="text-primary"> *</span>
              ) : null}
            </span>
            <select
              value={mapping[column.key] ?? ''}
              onChange={(event) =>
                setMapping((previous) => ({
                  ...previous,
                  [column.key]: event.target.value || undefined,
                }))
              }
              className={`${fieldInputClassName} max-w-44`}
            >
              <option value="">Not mapped</option>
              {table.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    )
  }

  function renderReviewStep() {
    const invalidRows = reviewRows.filter((row) => row.errors.length > 0)

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-border bg-muted/60 px-3 py-1">
            {reviewRows.length} rows
          </span>
          <span className="rounded-full border border-emerald-300/60 bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
            {validRows.length} ready to import
          </span>
          {invalidRows.length > 0 ? (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-destructive">
              {invalidRows.length} with problems
            </span>
          ) : null}
        </div>
        <div className="max-h-72 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reviewRows.slice(0, 200).map((row) => (
                <tr key={row.rowNumber} className="border-b border-border/60">
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {row.sku || '—'}
                  </td>
                  <td className="max-w-52 truncate px-3 py-1.5">
                    {row.name || '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    {row.errors.length === 0 ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-300">
                        Ready
                      </span>
                    ) : (
                      <span className="text-xs text-destructive">
                        {row.errors.join(' ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reviewRows.length > 200 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Showing the first 200 of {reviewRows.length} rows.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  function renderResults(summary: ProductImportSummary) {
    const issues = summary.results.filter(
      (rowResult) => rowResult.status !== 'created',
    )

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-500/10 p-3">
            <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
              {summary.created}
            </p>
            <p className="text-xs text-muted-foreground">Created</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-2xl font-semibold">{summary.skipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-2xl font-semibold text-destructive">
              {summary.failed}
            </p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="max-h-56 overflow-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((rowResult) => (
                  <tr
                    key={`${rowResult.row}-${rowResult.sku}`}
                    className="border-b border-border/60"
                  >
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {rowResult.row}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      {rowResult.sku}
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      <span className="capitalize">{rowResult.status}</span>
                      {rowResult.message ? ` — ${rowResult.message}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every row imported cleanly.
          </p>
        )}

        <div className="flex justify-end border-t border-border pt-4">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
          <DialogDescription>
            Bulk-create products with categories, brands, and units referenced
            by code. Existing SKUs are skipped, never overwritten.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          renderResults(result)
        ) : (
          <FormWizard
            key={sessionKey}
            steps={steps}
            renderStep={(step) =>
              step.id === 'source'
                ? renderSourceStep()
                : step.id === 'mapping'
                  ? renderMappingStep()
                  : renderReviewStep()
            }
            onComplete={runImport}
            onCancel={() => onOpenChange(false)}
            completeLabel={
              validRows.length > 0
                ? `Import ${validRows.length} ${validRows.length === 1 ? 'product' : 'products'}`
                : 'Import'
            }
            isPending={importMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
