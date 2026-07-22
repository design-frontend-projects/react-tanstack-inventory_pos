'use client'

import * as React from 'react'
import QRCode from 'qrcode'
import { Field, fieldInputClassName } from '#/components/forms/drawer-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { BarcodeSvg } from '#/features/products/barcode/barcode-svg'
import {
  LABEL_SIZES,
  buildLabelSheetHtml,
  openLabelPrintWindow,
} from '#/features/products/barcode/print-labels'
import { code128Svg, isEncodableCode128 } from '#/lib/barcode/code128'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'
import type { LabelSizeKey } from '#/features/products/barcode/print-labels'

// Print barcode labels for one product: choose symbology (Code 128 or QR),
// label size, copies, and which text lines appear. Printing opens a dedicated
// window sized via @page so thermal/label printers pick up the media size.

export interface LabelProduct {
  id: string
  sku: string
  name: string
  barcode?: string | null
  defaultPrice?: string | null
}

type Symbology = 'code128' | 'qr'

interface LabelPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: LabelProduct | null
}

export function LabelPrintDialog({
  open,
  onOpenChange,
  product,
}: LabelPrintDialogProps) {
  const [symbology, setSymbology] = React.useState<Symbology>('code128')
  const [sizeKey, setSizeKey] = React.useState<LabelSizeKey>('medium')
  const [copies, setCopies] = React.useState('1')
  const [includeName, setIncludeName] = React.useState(true)
  const [includePrice, setIncludePrice] = React.useState(false)
  const [qrSvg, setQrSvg] = React.useState<string | null>(null)
  const [isPrinting, setIsPrinting] = React.useState(false)

  // Barcode value: the dedicated barcode when present, otherwise the SKU.
  const value = product ? product.barcode?.trim() || product.sku : ''
  const code128Ready = value !== '' && isEncodableCode128(value)

  React.useEffect(() => {
    if (!open) {
      setSymbology('code128')
      setSizeKey('medium')
      setCopies('1')
      setIncludeName(true)
      setIncludePrice(false)
    }
  }, [open])

  // QR previews render from the same SVG string used for printing.
  React.useEffect(() => {
    let cancelled = false
    setQrSvg(null)

    if (open && symbology === 'qr' && value) {
      QRCode.toString(value, { type: 'svg', margin: 1 })
        .then((svg) => {
          if (!cancelled) {
            setQrSvg(svg)
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            notifyError(error, 'Could not generate the QR code')
          }
        })
    }

    return () => {
      cancelled = true
    }
  }, [open, symbology, value])

  const copyCount = Math.min(100, Math.max(1, Number(copies) || 1))

  async function handlePrint() {
    if (!product || !value) {
      return
    }

    setIsPrinting(true)
    try {
      const svg =
        symbology === 'qr'
          ? await QRCode.toString(value, { type: 'svg', margin: 1 })
          : code128Svg(value, { moduleWidth: 2, height: 56 })

      const label = {
        svg,
        code: value,
        title: includeName ? product.name : undefined,
        footer:
          includePrice && product.defaultPrice
            ? Number(product.defaultPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : undefined,
      }
      const html = buildLabelSheetHtml(
        Array.from({ length: copyCount }, () => label),
        LABEL_SIZES[sizeKey],
      )

      if (!openLabelPrintWindow(html)) {
        notifyError(
          new Error('Popup blocked'),
          'Allow popups for this site to print labels',
        )
        return
      }

      notifySuccess(
        'Label sheet ready',
        `${copyCount} ${copyCount === 1 ? 'label' : 'labels'} sent to the print window.`,
      )
      onOpenChange(false)
    } catch (error: unknown) {
      notifyError(error, 'Could not build the label sheet')
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Print barcode labels</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name} · ${product.sku}`
              : 'Select a product to print labels.'}
          </DialogDescription>
        </DialogHeader>

        {product ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              {symbology === 'code128' ? (
                code128Ready ? (
                  <BarcodeSvg value={value} height={56} className="mx-auto" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    “{value}” cannot be encoded as Code 128 — switch to QR or
                    assign an ASCII barcode/SKU.
                  </p>
                )
              ) : qrSvg ? (
                <div
                  className="mx-auto size-28 [&_svg]:size-full"
                  // Safe: SVG generated locally by the qrcode library.
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Generating QR…</p>
              )}
              <p className="mt-2 font-mono text-xs tracking-widest">{value}</p>
              {product.barcode?.trim() ? null : (
                <p className="mt-1 text-xs text-muted-foreground">
                  No barcode assigned — using the SKU.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Symbology">
                <select
                  value={symbology}
                  onChange={(event) =>
                    setSymbology(event.target.value as Symbology)
                  }
                  className={fieldInputClassName}
                >
                  <option value="code128">Code 128</option>
                  <option value="qr">QR code</option>
                </select>
              </Field>
              <Field label="Label size">
                <select
                  value={sizeKey}
                  onChange={(event) =>
                    setSizeKey(event.target.value as LabelSizeKey)
                  }
                  className={fieldInputClassName}
                >
                  {Object.entries(LABEL_SIZES).map(([key, size]) => (
                    <option key={key} value={key}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Copies" hint="1–100 labels, one per page">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={copies}
                  onChange={(event) => setCopies(event.target.value)}
                />
              </Field>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center justify-between gap-2 text-sm">
                  Product name
                  <Switch
                    checked={includeName}
                    onCheckedChange={setIncludeName}
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                  Price
                  <Switch
                    checked={includePrice}
                    onCheckedChange={setIncludePrice}
                    disabled={!product.defaultPrice}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handlePrint()}
                disabled={
                  isPrinting || (symbology === 'code128' && !code128Ready)
                }
              >
                {isPrinting ? 'Preparing…' : 'Print labels'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
