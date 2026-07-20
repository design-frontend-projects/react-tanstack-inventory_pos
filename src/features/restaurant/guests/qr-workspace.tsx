'use client'

import * as React from 'react'
import QRCode from 'qrcode'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { StatusChip } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useGuestMutations,
  useQrCampaigns,
} from '#/features/restaurant/guests/use-guests'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import { errorMessage, titleCase } from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'

interface QrRow {
  id: string
  name: string
  slug: string
  target: string
  targetUrl: string | null
  scanCount: number
  expiresAt: string | Date | null
  isActive: boolean
}

// Renders the campaign's QR into a data-URL image (no external requests).
function QrPreview({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [value])

  return dataUrl ? (
    <img
      src={dataUrl}
      alt={`QR code for ${value}`}
      className="size-44 rounded-xl border border-border bg-white p-2"
    />
  ) : (
    <div className="flex size-44 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
      Generating…
    </div>
  )
}

export function QrWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.qr.manage')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const campaignsQuery = useQrCampaigns(branchId)
  const mutations = useGuestMutations()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<QrRow | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const campaigns = (campaignsQuery.data ?? []) as Array<QrRow>
  const active = campaigns.filter((row) => row.isActive)
  const totalScans = campaigns.reduce((sum, row) => sum + row.scanCount, 0)

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  function qrValue(row: QrRow): string {
    return (
      row.targetUrl ??
      `${window.location.origin}/qr/${row.slug}`
    )
  }

  async function submitCreate() {
    setFormError(null)
    try {
      await mutations.createQrCampaign.mutateAsync({
        branchId: branchId ?? null,
        name: field('name'),
        slug: field('slug'),
        target: (field('target') || 'MENU') as never,
        targetUrl: field('targetUrl') || null,
        expiresAt: field('expiresAt')
          ? new Date(field('expiresAt')).toISOString()
          : null,
      })
      setCreateOpen(false)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<QrRow>> = [
    {
      id: 'name',
      header: 'Campaign',
      cell: (row) => row.name,
      sortValue: (row) => row.name,
    },
    { id: 'slug', header: 'Slug', cell: (row) => row.slug },
    { id: 'target', header: 'Target', cell: (row) => titleCase(row.target) },
    {
      id: 'scans',
      header: 'Scans',
      align: 'end',
      cell: (row) => row.scanCount.toLocaleString(),
      sortValue: (row) => row.scanCount,
    },
    {
      id: 'expiry',
      header: 'Expires',
      cell: (row) =>
        row.expiresAt
          ? new Date(row.expiresAt).toLocaleDateString()
          : 'Never',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation()
              setPreview(row)
            }}
          >
            QR
          </Button>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                void mutations.setQrCampaignActive.mutateAsync({
                  id: row.id,
                  isActive: !row.isActive,
                })
              }}
            >
              {row.isActive ? 'Disable' : 'Enable'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <AccessGuard
      permissions={['res.qr.manage', 'res.dashboard.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need QR access to manage codes."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Guests"
        title="QR ordering."
        description="Generate table, menu, and campaign QR codes with expiry and scan analytics."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            {canManage ? (
              <Button
                type="button"
                onClick={() => {
                  setFields({ target: 'MENU' })
                  setFormError(null)
                  setCreateOpen(true)
                }}
              >
                New QR
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: 'Campaigns',
            value: campaignsQuery.data ? String(campaigns.length) : '—',
            hint: 'QR codes issued',
            tone: 'red',
          },
          {
            label: 'Active',
            value: campaignsQuery.data ? String(active.length) : '—',
            hint: 'Currently scannable',
            tone: 'accent',
          },
          {
            label: 'Total scans',
            value: campaignsQuery.data ? totalScans.toLocaleString() : '—',
            hint: 'Across all codes',
            tone: 'neutral',
          },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <WorkspacePanel
            eyebrow="Codes"
            title="QR campaigns"
            description="Table QRs stay on the floor plan; campaign codes live here."
          >
            <DataTable
              columns={columns}
              rows={campaigns}
              rowKey={(row) => row.id}
              isLoading={campaignsQuery.isLoading}
              isError={campaignsQuery.isError}
              pageSize={12}
              onRowClick={(row) => setPreview(row)}
              emptyTitle="No QR campaigns"
              emptyDescription="Create a code to link guests to a menu or promotion."
            />
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Preview"
            title={preview ? preview.name : 'QR preview'}
            description={preview ? qrValue(preview) : 'Select a campaign to preview its code.'}
          >
            {preview ? (
              <div className="flex flex-col items-center gap-3">
                <QrPreview value={qrValue(preview)} />
                <p className="text-xs text-muted-foreground">
                  {preview.scanCount.toLocaleString()} scans
                </p>
              </div>
            ) : (
              <WorkspaceEmptyState
                title="Nothing selected"
                description="Pick a row to render its QR."
              />
            )}
          </WorkspacePanel>
        </div>
      </WorkspacePage>

      <DrawerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New QR campaign"
        description="Slug becomes the scannable link. Optionally point to a custom URL."
        onSubmit={submitCreate}
        isPending={mutations.createQrCampaign.isPending}
        error={formError}
        submitLabel="Create"
      >
        <Field label="Name" required>
          <input
            className={fieldInputClassName}
            value={field('name')}
            onChange={(event) => setField('name', event.target.value)}
            required
          />
        </Field>
        <Field label="Slug" required hint="Lowercase letters, digits, dashes">
          <input
            className={fieldInputClassName}
            value={field('slug')}
            onChange={(event) =>
              setField('slug', event.target.value.toLowerCase())
            }
            required
          />
        </Field>
        <Field label="Target">
          <select
            className={fieldInputClassName}
            value={field('target') || 'MENU'}
            onChange={(event) => setField('target', event.target.value)}
          >
            <option value="MENU">Menu</option>
            <option value="TABLE">Table</option>
            <option value="CAMPAIGN">Campaign</option>
          </select>
        </Field>
        <Field label="Custom URL" hint="Overrides the default /qr/slug link">
          <input
            className={fieldInputClassName}
            type="url"
            value={field('targetUrl')}
            onChange={(event) => setField('targetUrl', event.target.value)}
          />
        </Field>
        <Field label="Expires">
          <input
            className={fieldInputClassName}
            type="datetime-local"
            value={field('expiresAt')}
            onChange={(event) => setField('expiresAt', event.target.value)}
          />
        </Field>
      </DrawerForm>
    </AccessGuard>
  )
}
