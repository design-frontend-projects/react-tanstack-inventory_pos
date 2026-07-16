import { Link, createFileRoute } from '@tanstack/react-router'
import { Package, SearchIcon, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { WorkspacePage } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/')({
  component: InventoryOverviewPage,
})

type StockLevel = 'in' | 'low' | 'out'

type Item = {
  name: string
  sku: string
  price: string
  qty: number
  level: StockLevel
  swatch: string
  tall?: boolean
}

const filters = [
  'All items',
  'Dry goods',
  'Beverage',
  'Frozen',
  'Packaging',
] as const

const items: Array<Item> = [
  {
    name: 'Arabica beans 1kg',
    sku: 'BV-1042',
    price: 'EGP 420',
    qty: 8,
    level: 'low',
    swatch: 'from-amber-200 to-orange-300',
    tall: true,
  },
  {
    name: 'Oat milk 1L',
    sku: 'BV-2210',
    price: 'EGP 95',
    qty: 140,
    level: 'in',
    swatch: 'from-stone-200 to-stone-300',
  },
  {
    name: 'Takeaway cups 12oz',
    sku: 'PK-0087',
    price: 'EGP 1.8',
    qty: 3100,
    level: 'in',
    swatch: 'from-rose-200 to-rose-300',
  },
  {
    name: 'Vanilla syrup 750ml',
    sku: 'BV-3391',
    price: 'EGP 180',
    qty: 5,
    level: 'low',
    swatch: 'from-yellow-200 to-amber-300',
    tall: true,
  },
  {
    name: 'Frozen croissant',
    sku: 'FZ-1120',
    price: 'EGP 22',
    qty: 0,
    level: 'out',
    swatch: 'from-sky-200 to-blue-300',
  },
  {
    name: 'Napkins pack',
    sku: 'PK-0451',
    price: 'EGP 40',
    qty: 620,
    level: 'in',
    swatch: 'from-lime-200 to-green-300',
  },
  {
    name: 'Chocolate powder 2kg',
    sku: 'DG-7789',
    price: 'EGP 310',
    qty: 24,
    level: 'in',
    swatch: 'from-orange-200 to-amber-400',
    tall: true,
  },
  {
    name: 'Straws box',
    sku: 'PK-0512',
    price: 'EGP 55',
    qty: 12,
    level: 'low',
    swatch: 'from-teal-200 to-cyan-300',
  },
]

const levelBadge: Record<
  StockLevel,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  in: { label: 'In stock', variant: 'secondary' },
  low: { label: 'Low', variant: 'default' },
  out: { label: 'Out', variant: 'destructive' },
}

function InventoryOverviewPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory overview"
      title="A visual catalogue that surfaces coverage, movement, and reorder pressure at a glance."
      description="Browse the assortment as a live board — stock levels, prices, and reorder flags read instantly across every tile."
      metrics={[
        {
          label: 'Tracked SKUs',
          value: '10.4k',
          hint: 'Across all active tenants',
          tone: 'red',
        },
        {
          label: 'Low stock lanes',
          value: '28',
          hint: 'Auto-prioritized by threshold',
          tone: 'accent',
        },
        {
          label: 'Coverage window',
          value: '4.8d',
          hint: 'Median forecast until reorder',
          tone: 'neutral',
        },
      ]}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute inset-y-0 inset-s-3.5 my-auto size-4 text-muted-foreground" />
            <Input
              placeholder="Search SKU, name, or supplier"
              className="ps-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="gap-2">
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
            <Button asChild className="gap-2">
              <Link to="/inventory/catalog">
                <Package className="size-4" />
                Manage catalog
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <button
              key={filter}
              type="button"
              className={`pin-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                index === 0
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-secondary'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="pin-masonry">
          {items.map((item) => {
            const badge = levelBadge[item.level]
            return (
              <article key={item.sku} className="pin-card">
                <div
                  className={`flex items-center justify-center bg-linear-to-br ${item.swatch} ${
                    item.tall ? 'aspect-3/4' : 'aspect-square'
                  }`}
                >
                  <Package className="size-8 text-black/35" />
                </div>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">
                      {item.name}
                    </p>
                    <Badge variant={badge.variant} className="shrink-0">
                      {badge.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.sku}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold">{item.price}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.qty.toLocaleString()} on hand
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </WorkspacePage>
  )
}
