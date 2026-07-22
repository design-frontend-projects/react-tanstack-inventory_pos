import { z } from 'zod'

// Shared contract for the CSV product import: the wizard validates rows
// client-side for preview, and importProductsServerFn revalidates the same
// schema at the boundary. Rows reference master data by CODE (category, brand,
// UoM); the server resolves codes to ids.

export const PRODUCT_IMPORT_MAX_ROWS = 500

const trimmed = (max: number) => z.string().trim().min(1).max(max)

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === ''
        ? undefined
        : typeof value === 'string'
          ? value.trim()
          : value,
    z.string().max(max).optional(),
  )

const optionalDecimal = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z
    .string()
    .regex(/^\d+([.,]\d+)?$/, 'Must be a non-negative number')
    .transform((value) => value.replace(',', '.'))
    .optional(),
)

const optionalInt = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.coerce.number().int().min(0).optional(),
)

const TRUTHY = new Set(['true', 'yes', 'y', '1'])
const FALSY = new Set(['false', 'no', 'n', '0'])

const optionalBool = z.preprocess((value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (TRUTHY.has(normalized)) {
    return true
  }
  if (FALSY.has(normalized)) {
    return false
  }
  return value
}, z.boolean().optional())

// Enum cells tolerate case and spaces/dashes ("weighted average" → WEIGHTED_AVERAGE).
const enumInput = <T extends Readonly<[string, ...Array<string>]>>(values: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === ''
        ? undefined
        : typeof value === 'string'
          ? value
              .trim()
              .toUpperCase()
              .replace(/[\s-]+/g, '_')
          : value,
    z.enum(values).optional(),
  )

export const productImportRowSchema = z.object({
  sku: trimmed(64),
  name: trimmed(200),
  description: optionalText(2000),
  barcode: optionalText(64),
  categoryCode: optionalText(48),
  brandCode: optionalText(48),
  baseUomCode: trimmed(24),
  salesUomCode: optionalText(24),
  purchaseUomCode: optionalText(24),
  productType: enumInput([
    'SIMPLE',
    'VARIANT',
    'BUNDLE',
    'KIT',
    'SERVICE',
    'COMPOSITE',
  ]),
  trackingPolicy: enumInput(['NONE', 'LOT', 'SERIAL', 'LOT_SERIAL']),
  costingMethod: enumInput(['WEIGHTED_AVERAGE', 'FIFO', 'STANDARD']),
  status: enumInput(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
  standardCost: optionalDecimal,
  defaultPrice: optionalDecimal,
  reorderPoint: optionalDecimal,
  reorderQty: optionalDecimal,
  minStock: optionalDecimal,
  maxStock: optionalDecimal,
  safetyStock: optionalDecimal,
  leadTimeDays: optionalInt,
  shelfLifeDays: optionalInt,
  isStockTracked: optionalBool,
  hasExpiry: optionalBool,
})

export type ProductImportRow = z.infer<typeof productImportRowSchema>
export type ProductImportField = keyof ProductImportRow

export interface ImportColumnSpec {
  key: ProductImportField
  label: string
  required: boolean
  example: string
  // Normalized header names (lowercase, no punctuation) that auto-map to
  // this field when a CSV is loaded.
  aliases: Array<string>
}

export const IMPORT_COLUMNS: Array<ImportColumnSpec> = [
  {
    key: 'sku',
    label: 'SKU',
    required: true,
    example: 'SKU-0001',
    aliases: ['sku', 'item code', 'product code', 'code', 'reference'],
  },
  {
    key: 'name',
    label: 'Name',
    required: true,
    example: 'Espresso Beans 1kg',
    aliases: ['name', 'product name', 'item name', 'title', 'product'],
  },
  {
    key: 'baseUomCode',
    label: 'Base UoM code',
    required: true,
    example: 'PCS',
    aliases: [
      'base uom',
      'base uom code',
      'uom',
      'unit',
      'base unit',
      'unit of measure',
    ],
  },
  {
    key: 'description',
    label: 'Description',
    required: false,
    example: 'Single-origin arabica',
    aliases: ['description', 'details', 'notes'],
  },
  {
    key: 'barcode',
    label: 'Barcode',
    required: false,
    example: '6291041500213',
    aliases: ['barcode', 'ean', 'ean13', 'upc', 'gtin'],
  },
  {
    key: 'categoryCode',
    label: 'Category code',
    required: false,
    example: 'BEVERAGES',
    aliases: ['category', 'category code', 'category id'],
  },
  {
    key: 'brandCode',
    label: 'Brand code',
    required: false,
    example: 'ACME',
    aliases: ['brand', 'brand code'],
  },
  {
    key: 'salesUomCode',
    label: 'Sales UoM code',
    required: false,
    example: 'PCS',
    aliases: ['sales uom', 'sales uom code', 'sales unit', 'selling unit'],
  },
  {
    key: 'purchaseUomCode',
    label: 'Purchase UoM code',
    required: false,
    example: 'BOX',
    aliases: [
      'purchase uom',
      'purchase uom code',
      'purchase unit',
      'buying unit',
    ],
  },
  {
    key: 'productType',
    label: 'Product type',
    required: false,
    example: 'SIMPLE',
    aliases: ['product type', 'type'],
  },
  {
    key: 'trackingPolicy',
    label: 'Tracking policy',
    required: false,
    example: 'NONE',
    aliases: ['tracking policy', 'tracking'],
  },
  {
    key: 'costingMethod',
    label: 'Costing method',
    required: false,
    example: 'WEIGHTED_AVERAGE',
    aliases: ['costing method', 'costing'],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    example: 'ACTIVE',
    aliases: ['status', 'lifecycle'],
  },
  {
    key: 'standardCost',
    label: 'Standard cost',
    required: false,
    example: '12.50',
    aliases: ['standard cost', 'cost', 'unit cost', 'cost price'],
  },
  {
    key: 'defaultPrice',
    label: 'Default price',
    required: false,
    example: '19.99',
    aliases: [
      'default price',
      'price',
      'sale price',
      'selling price',
      'retail price',
    ],
  },
  {
    key: 'reorderPoint',
    label: 'Reorder point',
    required: false,
    example: '10',
    aliases: ['reorder point', 'reorder level'],
  },
  {
    key: 'reorderQty',
    label: 'Reorder quantity',
    required: false,
    example: '50',
    aliases: ['reorder qty', 'reorder quantity', 'order qty'],
  },
  {
    key: 'minStock',
    label: 'Minimum stock',
    required: false,
    example: '5',
    aliases: ['min stock', 'minimum stock', 'min'],
  },
  {
    key: 'maxStock',
    label: 'Maximum stock',
    required: false,
    example: '200',
    aliases: ['max stock', 'maximum stock', 'max'],
  },
  {
    key: 'safetyStock',
    label: 'Safety stock',
    required: false,
    example: '8',
    aliases: ['safety stock', 'buffer stock'],
  },
  {
    key: 'leadTimeDays',
    label: 'Lead time (days)',
    required: false,
    example: '7',
    aliases: ['lead time', 'lead time days'],
  },
  {
    key: 'shelfLifeDays',
    label: 'Shelf life (days)',
    required: false,
    example: '365',
    aliases: ['shelf life', 'shelf life days'],
  },
  {
    key: 'isStockTracked',
    label: 'Stock tracked',
    required: false,
    example: 'yes',
    aliases: ['stock tracked', 'track stock', 'is stock tracked', 'stocked'],
  },
  {
    key: 'hasExpiry',
    label: 'Has expiry',
    required: false,
    example: 'no',
    aliases: ['has expiry', 'expires', 'perishable', 'expiry'],
  },
]

// Normalizes a CSV header for alias matching: lowercase, punctuation → spaces.
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// header → field auto-mapping. Exact alias matches only; anything else stays
// unmapped for the user to assign manually.
export function autoMapHeaders(
  headers: Array<string>,
): Partial<Record<ProductImportField, string>> {
  const aliasIndex = new Map<string, ProductImportField>()

  for (const column of IMPORT_COLUMNS) {
    for (const alias of column.aliases) {
      aliasIndex.set(normalizeHeader(alias), column.key)
    }
  }

  return headers.reduce<Partial<Record<ProductImportField, string>>>(
    (mapping, header) => {
      const field = aliasIndex.get(normalizeHeader(header))
      if (field && mapping[field] === undefined) {
        return { ...mapping, [field]: header }
      }
      return mapping
    },
    {},
  )
}

export function buildImportTemplateCsv(): string {
  const headers = IMPORT_COLUMNS.map((column) => column.label).join(',')
  const example = IMPORT_COLUMNS.map((column) => column.example).join(',')
  return `${headers}\n${example}\n`
}
