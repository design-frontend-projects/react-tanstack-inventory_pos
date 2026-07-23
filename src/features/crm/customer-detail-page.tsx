'use client'

import * as React from 'react'
import {
  DetailMetaGrid,
  DetailPage,
  DetailPageHeader,
} from '#/components/layout/detail-page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Button } from '#/components/ui/button'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { Input } from '#/components/ui/input'
import { StatusChip } from '#/components/board/status-chip'
import { AuditTrail } from '#/components/documents/audit-trail'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useCustomer360,
  useLoyaltyAccount,
} from '#/features/crm/use-customer-360'
import { useCrmCustomerMutations } from '#/features/crm/use-crm-customers'
import { CustomerOverviewTab } from '#/features/crm/detail/customer-overview-tab'
import { CustomerTimelineTab } from '#/features/crm/detail/customer-timeline-tab'
import { CustomerLoyaltyTab } from '#/features/crm/detail/customer-loyalty-tab'
import { CustomerAnalyticsTab } from '#/features/crm/detail/customer-analytics-tab'
import {
  LIFECYCLE_STATUSES,
  errorMessage,
  formatLifecycle,
  formatNumber,
  lifecycleTone,
} from '#/features/crm/crm-format'
import type { LifecycleStatus } from '#/features/crm/crm-format'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// The customer 360 workspace: one header + meta strip, then tabbed satellites.
// All data comes from CRM projections and master-data services.

interface EditFormState {
  name: string
  email: string
  phone: string
  lifecycleStatus: LifecycleStatus
  vipLevel: string
  classification: string
  acquisitionChannel: string
  notes: string
}

export function CustomerDetailPage({ customerId }: { customerId: string }) {
  const { can } = usePermissions()
  const customerQuery = useCustomer360(customerId)
  const accountQuery = useLoyaltyAccount(customerId)
  const { updateCustomer } = useCrmCustomerMutations()

  const [editOpen, setEditOpen] = React.useState(false)
  const [editForm, setEditForm] = React.useState<EditFormState | null>(null)

  const data = customerQuery.data
  const customer = data?.customer
  const profile = data?.profile
  const account = accountQuery.data

  const canManageProfile = can(['crm.profile_manage'])
  const canManageMaster = can(['customer.manage'])
  const canViewLoyalty = can(['crm.loyalty_view'])
  const canViewAnalytics = can(['crm.analytics_view'])
  const canViewTimeline = can(['crm.timeline_view'])

  function openEdit() {
    if (!customer) {
      return
    }
    setEditForm({
      name: customer.name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      lifecycleStatus: (profile?.lifecycleStatus ??
        'PROSPECT') as LifecycleStatus,
      vipLevel: String(profile?.vipLevel ?? 0),
      classification: profile?.classification ?? '',
      acquisitionChannel: profile?.acquisitionChannel ?? '',
      notes: profile?.notes ?? '',
    })
    setEditOpen(true)
  }

  const header = (
    <DetailPageHeader
      eyebrow="Customer 360"
      title={customer?.name ?? 'Customer'}
      description={
        profile?.isCorporate && profile.companyName
          ? `Corporate account · ${profile.companyName}`
          : undefined
      }
      backTo="/crm/customers"
      backLabel="Customer directory"
      status={
        profile?.lifecycleStatus ? (
          <StatusChip
            tone={lifecycleTone[profile.lifecycleStatus as LifecycleStatus]}
            dot
          >
            {formatLifecycle(profile.lifecycleStatus)}
          </StatusChip>
        ) : undefined
      }
      actions={
        canManageMaster || canManageProfile ? (
          <Button size="sm" variant="outline" onClick={openEdit}>
            Edit customer
          </Button>
        ) : undefined
      }
    />
  )

  return (
    <DetailPage
      isLoading={customerQuery.isLoading}
      isError={customerQuery.isError && !customerQuery.isLoading}
      notFound={!customerQuery.isLoading && !customerQuery.isError && !customer}
      header={header}
      notFoundTitle="Customer not found"
      notFoundDescription="It may have been deleted, or you may not have access to it."
    >
      {customer ? (
        <>
          <DetailMetaGrid
            entries={[
              { label: 'Code', value: customer.code },
              { label: 'Type', value: customer.customerType.toLowerCase() },
              { label: 'Email', value: customer.email ?? '—' },
              { label: 'Phone', value: customer.phone ?? '—' },
              {
                label: 'Loyalty points',
                value: account ? formatNumber(account.pointsBalance) : '—',
              },
              { label: 'Tier', value: account?.tier?.name ?? 'No tier' },
              {
                label: 'VIP level',
                value: formatNumber(profile?.vipLevel ?? 0),
              },
              {
                label: 'Status',
                value: customer.isActive ? 'Active' : 'Inactive',
              },
            ]}
          />

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {canViewTimeline ? (
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              ) : null}
              {canViewLoyalty ? (
                <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
              ) : null}
              {canViewAnalytics ? (
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              ) : null}
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CustomerOverviewTab
                customerId={customerId}
                data={data}
                canManage={canManageProfile}
              />
            </TabsContent>

            {canViewTimeline ? (
              <TabsContent value="timeline">
                <CustomerTimelineTab
                  customerId={customerId}
                  canAddNote={can(['crm.timeline_note'])}
                />
              </TabsContent>
            ) : null}

            {canViewLoyalty ? (
              <TabsContent value="loyalty">
                <CustomerLoyaltyTab customerId={customerId} />
              </TabsContent>
            ) : null}

            {canViewAnalytics ? (
              <TabsContent value="analytics">
                <CustomerAnalyticsTab customerId={customerId} />
              </TabsContent>
            ) : null}

            <TabsContent value="audit">
              <AuditTrail entityType="customer" entityId={customerId} />
            </TabsContent>
          </Tabs>

          <DrawerForm
            open={editOpen}
            onOpenChange={setEditOpen}
            title="Edit customer"
            description="Master record and CRM profile in one save."
            isPending={updateCustomer.isPending}
            onSubmit={async () => {
              if (!editForm) {
                return
              }
              if (editForm.name.trim() === '') {
                notifyError('Name is required.')
                return
              }
              const vip = Number(editForm.vipLevel)
              if (!Number.isInteger(vip) || vip < 0 || vip > 100) {
                notifyError('VIP level must be between 0 and 100.')
                return
              }
              try {
                await updateCustomer.mutateAsync({
                  customerId,
                  master: canManageMaster
                    ? {
                        name: editForm.name.trim(),
                        email: editForm.email.trim() || null,
                        phone: editForm.phone.trim() || null,
                      }
                    : undefined,
                  profile: canManageProfile
                    ? {
                        lifecycleStatus: editForm.lifecycleStatus,
                        vipLevel: vip,
                        classification: editForm.classification.trim() || null,
                        acquisitionChannel:
                          editForm.acquisitionChannel.trim() || null,
                        notes: editForm.notes.trim() || null,
                      }
                    : undefined,
                })
                notifySuccess('Customer updated')
                setEditOpen(false)
              } catch (error: unknown) {
                notifyError(errorMessage(error))
              }
            }}
          >
            {editForm ? (
              <>
                {canManageMaster ? (
                  <>
                    <Field label="Name" required>
                      <Input
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm({ ...editForm, name: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            email: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editForm.phone}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            phone: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </>
                ) : null}
                {canManageProfile ? (
                  <>
                    <Field label="Lifecycle stage">
                      <select
                        className={fieldInputClassName}
                        value={editForm.lifecycleStatus}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            lifecycleStatus: event.target
                              .value as LifecycleStatus,
                          })
                        }
                      >
                        {LIFECYCLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {formatLifecycle(status)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="VIP level" hint="0–100">
                      <Input
                        value={editForm.vipLevel}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            vipLevel: event.target.value,
                          })
                        }
                        inputMode="numeric"
                      />
                    </Field>
                    <Field label="Classification">
                      <Input
                        value={editForm.classification}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            classification: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Acquisition channel">
                      <Input
                        value={editForm.acquisitionChannel}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            acquisitionChannel: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Internal notes">
                      <textarea
                        value={editForm.notes}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            notes: event.target.value,
                          })
                        }
                        rows={3}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}
          </DrawerForm>
        </>
      ) : (
        <div />
      )}
    </DetailPage>
  )
}
