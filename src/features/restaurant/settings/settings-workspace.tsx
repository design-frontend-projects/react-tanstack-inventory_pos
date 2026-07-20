'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterTabs } from '#/components/data/filter-bar'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { StatusChip } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useRestaurants,
  useServiceChargeRules,
  useServiceTypes,
  useSettingsBranches,
  useSettingsMutations,
  useSettingsStations,
  useTaxConfigs,
} from '#/features/restaurant/settings/use-settings'
import { errorMessage, titleCase } from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'

type SettingsTab =
  | 'restaurants'
  | 'branches'
  | 'service-types'
  | 'stations'
  | 'taxes'
  | 'service-charges'

const TABS = [
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'branches', label: 'Branches' },
  { value: 'service-types', label: 'Service types' },
  { value: 'stations', label: 'Kitchen stations' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'service-charges', label: 'Service charges' },
]

function activeChip(isActive: boolean) {
  return (
    <StatusChip tone={isActive ? 'success' : 'neutral'} dot>
      {isActive ? 'Active' : 'Inactive'}
    </StatusChip>
  )
}

export function RestaurantSettingsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = permissions.includes('res.settings.manage')

  const [tab, setTab] = React.useState<SettingsTab>('restaurants')
  const { branches: pickerBranches, branchId, setBranchId } = useBranchSelection()

  const restaurantsQuery = useRestaurants()
  const branchesQuery = useSettingsBranches()
  const serviceTypesQuery = useServiceTypes(branchId)
  const stationsQuery = useSettingsStations(branchId)
  const taxesQuery = useTaxConfigs(branchId)
  const chargesQuery = useServiceChargeRules(branchId)
  const mutations = useSettingsMutations()

  const [drawer, setDrawer] = React.useState<SettingsTab | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  // One shared field bag keeps the drawer forms simple; each tab reads the
  // fields it needs and resets on open.
  const [fields, setFields] = React.useState<Record<string, string>>({})

  function openDrawer(target: SettingsTab) {
    setFields({})
    setFormError(null)
    setDrawer(target)
  }

  function field(key: string): string {
    return fields[key] ?? ''
  }

  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function submitDrawer() {
    setFormError(null)
    try {
      if (drawer === 'restaurants') {
        await mutations.createRestaurant.mutateAsync({
          code: field('code'),
          name: field('name'),
        })
      } else if (drawer === 'branches') {
        const restaurantId =
          field('restaurantId') || (restaurantsQuery.data?.[0]?.id ?? '')
        await mutations.createBranch.mutateAsync({
          restaurantId,
          code: field('code'),
          name: field('name'),
          phone: field('phone') || null,
          timezone: field('timezone') || null,
        })
      } else if (drawer === 'service-types') {
        await mutations.createServiceType.mutateAsync({
          branchId: branchId ?? null,
          code: field('code'),
          name: field('name'),
          kind: (field('kind') || 'DINE_IN') as never,
        })
      } else if (drawer === 'stations') {
        await mutations.createStation.mutateAsync({
          branchId: branchId as string,
          code: field('code'),
          name: field('name'),
        })
      } else if (drawer === 'taxes') {
        await mutations.createTaxConfig.mutateAsync({
          branchId: branchId ?? null,
          code: field('code'),
          name: field('name'),
          rate: field('rate'),
          isInclusive: field('isInclusive') === 'yes',
          appliesTo: (field('appliesTo') || 'ORDER') as never,
        })
      } else if (drawer === 'service-charges') {
        await mutations.createServiceCharge.mutateAsync({
          branchId: branchId ?? null,
          code: field('code'),
          name: field('name'),
          chargeType: (field('chargeType') || 'PERCENT') as never,
          value: field('value'),
          minGuests: field('minGuests') ? Number(field('minGuests')) : null,
          isTaxable: field('isTaxable') === 'yes',
        })
      }
      setDrawer(null)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  const isPending =
    mutations.createRestaurant.isPending ||
    mutations.createBranch.isPending ||
    mutations.createServiceType.isPending ||
    mutations.createStation.isPending ||
    mutations.createTaxConfig.isPending ||
    mutations.createServiceCharge.isPending

  const restaurantColumns: Array<
    DataTableColumn<NonNullable<typeof restaurantsQuery.data>[number]>
  > = [
    { id: 'code', header: 'Code', cell: (row) => row.code, sortValue: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
    { id: 'currency', header: 'Currency', cell: (row) => row.defaultCurrency },
    { id: 'status', header: 'Status', cell: (row) => activeChip(row.isActive) },
  ]

  const branchColumns: Array<
    DataTableColumn<NonNullable<typeof branchesQuery.data>[number]>
  > = [
    { id: 'code', header: 'Code', cell: (row) => row.code, sortValue: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
    { id: 'phone', header: 'Phone', cell: (row) => row.phone ?? '—' },
    { id: 'timezone', header: 'Timezone', cell: (row) => row.timezone ?? '—' },
    {
      id: 'default',
      header: 'Default',
      cell: (row) =>
        row.isDefault ? <StatusChip tone="primary">Default</StatusChip> : null,
    },
    { id: 'status', header: 'Status', cell: (row) => activeChip(row.isActive) },
  ]

  const serviceTypeColumns: Array<
    DataTableColumn<NonNullable<typeof serviceTypesQuery.data>[number]>
  > = [
    { id: 'code', header: 'Code', cell: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name },
    { id: 'kind', header: 'Kind', cell: (row) => titleCase(row.kind) },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) => (row.branchId ? 'Branch' : 'All branches'),
    },
  ]

  const stationColumns: Array<
    DataTableColumn<NonNullable<typeof stationsQuery.data>[number]>
  > = [
    { id: 'code', header: 'Code', cell: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name },
    { id: 'order', header: 'Order', align: 'end', cell: (row) => row.displayOrder },
  ]

  const taxColumns: Array<
    DataTableColumn<NonNullable<typeof taxesQuery.data>[number]>
  > = [
    { id: 'code', header: 'Code', cell: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name },
    {
      id: 'rate',
      header: 'Rate %',
      align: 'end',
      cell: (row) => row.rate,
      sortValue: (row) => Number(row.rate),
    },
    {
      id: 'inclusive',
      header: 'Inclusive',
      cell: (row) => (row.isInclusive ? 'Yes' : 'No'),
    },
    { id: 'applies', header: 'Applies to', cell: (row) => titleCase(row.appliesTo) },
  ]

  const chargeColumns: Array<
    DataTableColumn<NonNullable<typeof chargesQuery.data>[number]>
  > = [
    { id: 'code', header: 'Code', cell: (row) => row.code },
    { id: 'name', header: 'Name', cell: (row) => row.name },
    { id: 'type', header: 'Type', cell: (row) => titleCase(row.chargeType) },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      cell: (row) => row.value,
      sortValue: (row) => Number(row.value),
    },
    {
      id: 'minGuests',
      header: 'Min guests',
      align: 'end',
      cell: (row) => row.minGuests ?? '—',
    },
    { id: 'taxable', header: 'Taxable', cell: (row) => (row.isTaxable ? 'Yes' : 'No') },
  ]

  const addLabels: Record<SettingsTab, string> = {
    restaurants: 'New restaurant',
    branches: 'New branch',
    'service-types': 'New service type',
    stations: 'New station',
    taxes: 'New tax',
    'service-charges': 'New service charge',
  }

  return (
    <AccessGuard
      permissions={['res.settings.manage', 'res.dashboard.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need settings access to configure the restaurant."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Configuration"
        title="Restaurant setup."
        description="Master data behind every service surface: restaurants, branches, service types, stations, taxes, and service charges."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker
              branches={pickerBranches}
              branchId={branchId}
              onChange={setBranchId}
            />
            {canManage ? (
              <Button type="button" onClick={() => openDrawer(tab)}>
                {addLabels[tab]}
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: 'Restaurants',
            value: restaurantsQuery.data
              ? String(restaurantsQuery.data.length)
              : '—',
            hint: 'Brands in this tenant',
            tone: 'red',
          },
          {
            label: 'Branches',
            value: branchesQuery.data ? String(branchesQuery.data.length) : '—',
            hint: 'Locations configured',
            tone: 'neutral',
          },
          {
            label: 'Stations',
            value: stationsQuery.data ? String(stationsQuery.data.length) : '—',
            hint: 'In the selected branch',
            tone: 'accent',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Master data"
          title="Configuration areas"
          description="Floors, areas, and tables are managed in the Floor Plan screen."
        >
          <div className="mb-4">
            <FilterTabs
              tabs={TABS}
              value={tab}
              onChange={(value) => setTab(value as SettingsTab)}
            />
          </div>

          {tab === 'restaurants' ? (
            <DataTable
              columns={restaurantColumns}
              rows={restaurantsQuery.data ?? []}
              rowKey={(row) => row.id}
              isLoading={restaurantsQuery.isLoading}
              isError={restaurantsQuery.isError}
              emptyTitle="No restaurants yet"
              emptyDescription="Create the first restaurant brand to get started."
            />
          ) : null}
          {tab === 'branches' ? (
            <DataTable
              columns={branchColumns}
              rows={branchesQuery.data ?? []}
              rowKey={(row) => row.id}
              isLoading={branchesQuery.isLoading}
              isError={branchesQuery.isError}
              emptyTitle="No branches yet"
              emptyDescription="Add a branch to run service at a location."
            />
          ) : null}
          {tab === 'service-types' ? (
            <DataTable
              columns={serviceTypeColumns}
              rows={serviceTypesQuery.data ?? []}
              rowKey={(row) => row.id}
              isLoading={serviceTypesQuery.isLoading}
              isError={serviceTypesQuery.isError}
              emptyTitle="No service types"
              emptyDescription="Define dine-in, takeaway, delivery, and other service kinds."
            />
          ) : null}
          {tab === 'stations' ? (
            <DataTable
              columns={stationColumns}
              rows={stationsQuery.data ?? []}
              rowKey={(row) => row.id}
              isLoading={stationsQuery.isLoading}
              isError={stationsQuery.isError}
              emptyTitle="No kitchen stations"
              emptyDescription="Stations route order items to the right prep screen."
            />
          ) : null}
          {tab === 'taxes' ? (
            <DataTable
              columns={taxColumns}
              rows={taxesQuery.data ?? []}
              rowKey={(row) => row.id}
              isLoading={taxesQuery.isLoading}
              isError={taxesQuery.isError}
              emptyTitle="No tax configuration"
              emptyDescription="Add tax rules applied to orders and lines."
            />
          ) : null}
          {tab === 'service-charges' ? (
            <DataTable
              columns={chargeColumns}
              rows={chargesQuery.data ?? []}
              rowKey={(row) => row.id}
              isLoading={chargesQuery.isLoading}
              isError={chargesQuery.isError}
              emptyTitle="No service charge rules"
              emptyDescription="Add automatic service charges for dine-in or events."
            />
          ) : null}
        </WorkspacePanel>
      </WorkspacePage>

      <DrawerForm
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null)
        }}
        title={drawer ? addLabels[drawer] : ''}
        description="Codes are unique per tenant and cannot be changed later."
        onSubmit={submitDrawer}
        isPending={isPending}
        error={formError}
        submitLabel="Create"
      >
        {/* Shared fields */}
        <Field label="Code" required>
          <input
            className={fieldInputClassName}
            value={field('code')}
            onChange={(event) => setField('code', event.target.value)}
            required
          />
        </Field>
        <Field label="Name" required>
          <input
            className={fieldInputClassName}
            value={field('name')}
            onChange={(event) => setField('name', event.target.value)}
            required
          />
        </Field>

        {drawer === 'branches' ? (
          <>
            <Field label="Restaurant" required>
              <select
                className={fieldInputClassName}
                value={field('restaurantId')}
                onChange={(event) => setField('restaurantId', event.target.value)}
              >
                {(restaurantsQuery.data ?? []).map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input
                className={fieldInputClassName}
                value={field('phone')}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </Field>
            <Field label="Timezone" hint="e.g. Africa/Cairo">
              <input
                className={fieldInputClassName}
                value={field('timezone')}
                onChange={(event) => setField('timezone', event.target.value)}
              />
            </Field>
          </>
        ) : null}

        {drawer === 'service-types' ? (
          <Field label="Kind" required>
            <select
              className={fieldInputClassName}
              value={field('kind') || 'DINE_IN'}
              onChange={(event) => setField('kind', event.target.value)}
            >
              {[
                'DINE_IN',
                'TAKEAWAY',
                'PICKUP',
                'DELIVERY',
                'DRIVE_THRU',
                'QR_ORDER',
              ].map((kind) => (
                <option key={kind} value={kind}>
                  {titleCase(kind)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {drawer === 'taxes' ? (
          <>
            <Field label="Rate %" required>
              <input
                className={fieldInputClassName}
                type="number"
                step="0.01"
                min="0"
                value={field('rate')}
                onChange={(event) => setField('rate', event.target.value)}
                required
              />
            </Field>
            <Field label="Applies to">
              <select
                className={fieldInputClassName}
                value={field('appliesTo') || 'ORDER'}
                onChange={(event) => setField('appliesTo', event.target.value)}
              >
                {['ORDER', 'LINE', 'SERVICE_CHARGE', 'DELIVERY'].map((target) => (
                  <option key={target} value={target}>
                    {titleCase(target)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tax-inclusive prices">
              <select
                className={fieldInputClassName}
                value={field('isInclusive') || 'no'}
                onChange={(event) => setField('isInclusive', event.target.value)}
              >
                <option value="no">No — added on top</option>
                <option value="yes">Yes — included in prices</option>
              </select>
            </Field>
          </>
        ) : null}

        {drawer === 'service-charges' ? (
          <>
            <Field label="Charge type">
              <select
                className={fieldInputClassName}
                value={field('chargeType') || 'PERCENT'}
                onChange={(event) => setField('chargeType', event.target.value)}
              >
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </Field>
            <Field label="Value" required>
              <input
                className={fieldInputClassName}
                type="number"
                step="0.01"
                min="0"
                value={field('value')}
                onChange={(event) => setField('value', event.target.value)}
                required
              />
            </Field>
            <Field label="Minimum guests" hint="Apply only at or above this party size">
              <input
                className={fieldInputClassName}
                type="number"
                min="0"
                value={field('minGuests')}
                onChange={(event) => setField('minGuests', event.target.value)}
              />
            </Field>
            <Field label="Taxable">
              <select
                className={fieldInputClassName}
                value={field('isTaxable') || 'no'}
                onChange={(event) => setField('isTaxable', event.target.value)}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </>
        ) : null}
      </DrawerForm>
    </AccessGuard>
  )
}
