import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Coffee,
  CroissantIcon,
  CupSoda,
  Minus,
  Plus,
  Sandwich,
  ScanLine,
  SearchIcon,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { WorkspacePage } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/')({
  component: PosCheckoutPage,
})

type Product = {
  name: string
  price: string
  icon: LucideIcon
  swatch: string
}

const categories = ['All', 'Coffee', 'Cold drinks', 'Bakery', 'Food'] as const

const products: Array<Product> = [
  {
    name: 'Espresso',
    price: 'EGP 35',
    icon: Coffee,
    swatch: 'from-amber-200 to-amber-400',
  },
  {
    name: 'Cappuccino',
    price: 'EGP 55',
    icon: Coffee,
    swatch: 'from-orange-200 to-orange-400',
  },
  {
    name: 'Iced Latte',
    price: 'EGP 65',
    icon: CupSoda,
    swatch: 'from-sky-200 to-sky-400',
  },
  {
    name: 'Croissant',
    price: 'EGP 45',
    icon: CroissantIcon,
    swatch: 'from-yellow-200 to-yellow-400',
  },
  {
    name: 'Club Sandwich',
    price: 'EGP 120',
    icon: Sandwich,
    swatch: 'from-rose-200 to-rose-400',
  },
  {
    name: 'Cold Brew',
    price: 'EGP 70',
    icon: CupSoda,
    swatch: 'from-teal-200 to-teal-400',
  },
  {
    name: 'Flat White',
    price: 'EGP 60',
    icon: Coffee,
    swatch: 'from-stone-200 to-stone-400',
  },
  {
    name: 'Lemonade',
    price: 'EGP 40',
    icon: CupSoda,
    swatch: 'from-lime-200 to-lime-400',
  },
]

const cartLines = [
  { name: 'Cappuccino', qty: 2, price: 'EGP 110' },
  { name: 'Croissant', qty: 1, price: 'EGP 45' },
  { name: 'Iced Latte', qty: 1, price: 'EGP 65' },
]

function PosCheckoutPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="POS checkout"
      title="A fast, tactile checkout: scan, tap a tile, and settle without leaving the frame."
      description="Product tiles on the left, a persistent basket on the right — tuned for speed on tablet and counter screens."
      metrics={[
        {
          label: 'Open baskets',
          value: '14',
          hint: 'Across current lanes',
          tone: 'red',
        },
        {
          label: 'Average ticket',
          value: 'EGP 218',
          hint: 'Rolling 2 hour window',
          tone: 'neutral',
        },
        {
          label: 'Void risk',
          value: '2',
          hint: 'Transactions require review',
          tone: 'accent',
        },
      ]}
      actions={
        <Button asChild size="lg">
          <Link to="/pos/orders">Review order queue</Link>
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        {/* Product catalogue */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute inset-y-0 inset-s-3.5 my-auto size-4 text-muted-foreground" />
              <Input
                placeholder="Search products or scan a barcode"
                className="ps-10"
              />
            </div>
            <Button variant="secondary" className="gap-2">
              <ScanLine className="size-4" />
              Scan
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <button
                key={category}
                type="button"
                className={`pin-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                  index === 0
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map(({ name, price, icon: Icon, swatch }) => (
              <button
                key={name}
                type="button"
                className="pin-card group/tile text-start"
              >
                <div
                  className={`flex aspect-square items-center justify-center bg-linear-to-br ${swatch}`}
                >
                  <Icon className="size-9 text-black/45" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{price}</p>
                  </div>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover/tile:scale-110">
                    <Plus className="size-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Basket rail */}
        <aside className="pin-card h-fit p-5 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <p className="ops-panel-label">Current basket</p>
            <Badge variant="secondary">Lane 3</Badge>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {cartLines.map((line) => (
              <div key={line.name} className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                  <span className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                    <Minus className="size-3.5" />
                  </span>
                  <span className="min-w-4 text-center text-sm font-semibold tabular-nums">
                    {line.qty}
                  </span>
                  <span className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                    <Plus className="size-3.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                </div>
                <span className="text-sm font-semibold">{line.price}</span>
              </div>
            ))}
          </div>

          <div className="my-4 h-px bg-border" />

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd>EGP 220</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Service &amp; tax</dt>
              <dd>EGP 31</dd>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <dt className="text-base font-bold">Total</dt>
              <dd className="text-2xl font-bold tracking-tight text-primary">
                EGP 251
              </dd>
            </div>
          </dl>

          <Button size="lg" className="mt-5 w-full">
            Charge EGP 251
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm">
              Hold
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          </div>
        </aside>
      </div>
    </WorkspacePage>
  )
}
