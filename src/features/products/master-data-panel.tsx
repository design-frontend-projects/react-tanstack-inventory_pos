'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  BrandFormDialog,
  CategoryFormDialog,
  UomFormDialog,
} from '#/features/products/master-data-dialogs'
import type {
  BrandFormValues,
  CategoryFormValues,
  UomFormValues,
} from '#/features/products/master-data-dialogs'
import {
  useBrands,
  useCategories,
  useUoms,
} from '#/features/products/use-master-data'

type MasterDataTab = 'categories' | 'brands' | 'units'

const TABS: Array<{ key: MasterDataTab; label: string }> = [
  { key: 'categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'units', label: 'Units' },
]

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium">
      {isActive ? 'active' : 'inactive'}
    </span>
  )
}

const headerRowClassName =
  'border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground'

// Order categories parent-first (materialized path), so the depth indent reads
// as a tree.
function byPath(a: { path: string | null }, b: { path: string | null }) {
  return (a.path ?? '').localeCompare(b.path ?? '')
}

export function MasterDataPanel() {
  const [tab, setTab] = React.useState<MasterDataTab>('categories')
  const [categoryDialog, setCategoryDialog] = React.useState(false)
  const [editingCategory, setEditingCategory] =
    React.useState<CategoryFormValues | null>(null)
  const [brandDialog, setBrandDialog] = React.useState(false)
  const [editingBrand, setEditingBrand] =
    React.useState<BrandFormValues | null>(null)
  const [uomDialog, setUomDialog] = React.useState(false)
  const [editingUom, setEditingUom] = React.useState<UomFormValues | null>(null)

  const categoriesQuery = useCategories()
  const brandsQuery = useBrands()
  const uomsQuery = useUoms()

  const categories = [...(categoriesQuery.data ?? [])].sort(byPath)
  const brands = brandsQuery.data ?? []
  const uoms = uomsQuery.data ?? []

  const openNew = () => {
    if (tab === 'categories') {
      setEditingCategory(null)
      setCategoryDialog(true)
    } else if (tab === 'brands') {
      setEditingBrand(null)
      setBrandDialog(true)
    } else {
      setEditingUom(null)
      setUomDialog(true)
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Master data"
      title="Categories, brands & units"
      description="Reference data the product register depends on. Writes require catalog management permission."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className={
                tab === entry.key
                  ? 'rounded-md bg-card px-3 py-1.5 text-sm font-medium shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
        <Button size="xs" onClick={openNew}>
          {tab === 'categories'
            ? 'New category'
            : tab === 'brands'
              ? 'New brand'
              : 'New unit'}
        </Button>
      </div>

      {tab === 'categories' ? (
        categories.length === 0 ? (
          <WorkspaceEmptyState
            title="No categories yet"
            description="Create a category tree to organise the catalog."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-sm">
              <thead>
                <tr className={headerRowClassName}>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      <span
                        style={{
                          paddingInlineStart: `${category.depth * 1.25}rem`,
                        }}
                        className="font-medium"
                      >
                        {category.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {category.code}
                    </td>
                    <td className="py-2 pr-4">
                      <ActiveBadge isActive={category.isActive} />
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setEditingCategory({
                            id: category.id,
                            code: category.code,
                            name: category.name,
                            parentId: category.parentId,
                            displayOrder: category.displayOrder,
                            isActive: category.isActive,
                          })
                          setCategoryDialog(true)
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'brands' ? (
        brands.length === 0 ? (
          <WorkspaceEmptyState
            title="No brands yet"
            description="Create brands to group products by label."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-sm">
              <thead>
                <tr className={headerRowClassName}>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{brand.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {brand.code}
                    </td>
                    <td className="py-2 pr-4">
                      <ActiveBadge isActive={brand.isActive} />
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setEditingBrand({
                            id: brand.id,
                            code: brand.code,
                            name: brand.name,
                            isActive: brand.isActive,
                          })
                          setBrandDialog(true)
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'units' ? (
        uoms.length === 0 ? (
          <WorkspaceEmptyState
            title="No units yet"
            description="Create units of measure before registering products."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-sm">
              <thead>
                <tr className={headerRowClassName}>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 text-right font-medium">Decimals</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uoms.map((uom) => (
                  <tr key={uom.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">
                      {uom.name}
                      {uom.symbol ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({uom.symbol})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{uom.code}</td>
                    <td className="py-2 pr-4 lowercase">{uom.uomType}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {uom.decimalPlaces}
                    </td>
                    <td className="py-2 pr-4">
                      <ActiveBadge isActive={uom.isActive} />
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setEditingUom({
                            id: uom.id,
                            code: uom.code,
                            name: uom.name,
                            symbol: uom.symbol,
                            uomType: uom.uomType,
                            isBaseUnit: uom.isBaseUnit,
                            decimalPlaces: uom.decimalPlaces,
                            isActive: uom.isActive,
                          })
                          setUomDialog(true)
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <CategoryFormDialog
        open={categoryDialog}
        onOpenChange={setCategoryDialog}
        category={editingCategory}
      />
      <BrandFormDialog
        open={brandDialog}
        onOpenChange={setBrandDialog}
        brand={editingBrand}
      />
      <UomFormDialog
        open={uomDialog}
        onOpenChange={setUomDialog}
        uom={editingUom}
      />
    </WorkspacePanel>
  )
}
