'use client'

// Builds a printable label sheet (one label per page) and opens it in a print
// window. Pure HTML/CSS with inline SVG so the print output has no runtime
// dependencies and works with thermal label printers via @page sizing.

export type LabelSizeKey = 'small' | 'medium' | 'large'

export interface LabelSize {
  label: string
  widthMm: number
  heightMm: number
}

export const LABEL_SIZES: Record<LabelSizeKey, LabelSize> = {
  small: { label: '38 × 25 mm (shelf tag)', widthMm: 38, heightMm: 25 },
  medium: { label: '50 × 30 mm (standard)', widthMm: 50, heightMm: 30 },
  large: { label: '100 × 50 mm (carton)', widthMm: 100, heightMm: 50 },
}

export interface LabelContent {
  // Pre-rendered barcode/QR SVG markup (from code128Svg or qrcode.toString).
  svg: string
  code: string
  title?: string
  footer?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildLabelSheetHtml(
  labels: Array<LabelContent>,
  size: LabelSize,
): string {
  const body = labels
    .map(
      (label) => `
      <div class="label">
        ${label.title ? `<div class="title">${escapeHtml(label.title)}</div>` : ''}
        <div class="barcode">${label.svg}</div>
        <div class="code">${escapeHtml(label.code)}</div>
        ${label.footer ? `<div class="footer">${escapeHtml(label.footer)}</div>` : ''}
      </div>`,
    )
    .join('\n')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Labels</title>
<style>
  @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, sans-serif; }
  .label {
    width: ${size.widthMm}mm;
    height: ${size.heightMm}mm;
    padding: 1.5mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.8mm;
    overflow: hidden;
    page-break-after: always;
  }
  .title {
    font-size: ${size.heightMm >= 50 ? 11 : 7.5}pt;
    font-weight: 600;
    text-align: center;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .barcode { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; max-width: 100%; }
  .barcode svg { max-width: ${size.widthMm - 4}mm; max-height: 100%; height: auto; }
  .code { font-size: ${size.heightMm >= 50 ? 9 : 6.5}pt; letter-spacing: 0.08em; }
  .footer { font-size: ${size.heightMm >= 50 ? 10 : 7}pt; font-weight: 700; }
</style>
</head>
<body>
${body}
<script>window.addEventListener('load', function () { window.focus(); window.print(); });</script>
</body>
</html>`
}

// Returns false when the browser blocked the popup so callers can surface a
// user-facing hint instead of failing silently.
export function openLabelPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=720,height=560')

  if (!printWindow) {
    return false
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  return true
}
