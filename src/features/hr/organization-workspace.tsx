'use client'

import * as React from 'react'
import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { BranchDialog, CompanyDialog } from '#/features/hr/hr-dialogs'
import type {
  BranchFormValues,
  CompanyFormValues,
} from '#/features/hr/hr-dialogs'
import {
  useBranches,
  useCompanies,
  useOrganizationMutations,
} from '#/features/hr/use-organization'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.org_view']
const MANAGE = ['hr.org_manage']

type CompanyRow = NonNullable<ReturnType<typeof useCompanies>['data']>[number]
type BranchRow = NonNullable<ReturnType<typeof useBranches>['data']>[number]

export function OrganizationWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)

  const companiesQuery = useCompanies()
  const branchesQuery = useBranches()
  const { company: companyMut, branch: branchMut } = useOrganizationMutations()

  const [companyDialog, setCompanyDialog] = React.useState(false)
  const [editingCompany, setEditingCompany] =
    React.useState<CompanyFormValues | null>(null)
  const [branchDialog, setBranchDialog] = React.useState(false)
  const [editingBranch, setEditingBranch] =
    React.useState<BranchFormValues | null>(null)
  const [pendingCompany, setPendingCompany] = React.useState<CompanyRow | null>(
    null,
  )
  const [pendingBranch, setPendingBranch] = React.useState<BranchRow | null>(
    null,
  )

  const companies = companiesQuery.data ?? []
  const branches = branchesQuery.data ?? []
  const companyName = React.useCallback(
    (id: string | null) => companies.find((c) => c.id === id)?.name ?? '—',
    [companies],
  )

  const companyColumns: DataTableColumn<CompanyRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      id: 'currency',
      header: 'Currency',
      cell: (r) => r.currencyCode,
      sortValue: (r) => r.currencyCode,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={r.isActive ? 'success' : 'neutral'}>
          {r.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (r) => (r.isActive ? 'a' : 'z'),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditingCompany({
                  id: r.id,
                  code: r.code,
                  name: r.name,
                  nameAr: r.nameAr,
                  currencyCode: r.currencyCode,
                  isActive: r.isActive,
                })
                setCompanyDialog(true)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPendingCompany(r)}
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ]

  const branchColumns: DataTableColumn<BranchRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      id: 'company',
      header: 'Company',
      cell: (r) => companyName(r.companyId),
      sortValue: (r) => companyName(r.companyId),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => r.branchType,
      sortValue: (r) => r.branchType,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditingBranch({
                  id: r.id,
                  companyId: r.companyId,
                  code: r.code,
                  name: r.name,
                  branchType: r.branchType,
                  isActive: r.isActive,
                })
                setBranchDialog(true)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPendingBranch(r)}
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Organization"
      title="Model the legal and operational structure of your business."
      description="Companies are legal entities; branches are their physical or operating sites. Departments, positions, and cost centers hang off this structure."
      actions={
        canManage ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingCompany(null)
                setCompanyDialog(true)
              }}
            >
              New company
            </Button>
            <Button
              onClick={() => {
                setEditingBranch(null)
                setBranchDialog(true)
              }}
            >
              New branch
            </Button>
          </div>
        ) : null
      }
      metrics={[
        {
          label: 'Companies',
          value: companiesQuery.isLoading ? '—' : String(companies.length),
          hint: 'Legal entities',
          tone: 'red',
        },
        {
          label: 'Branches',
          value: branchesQuery.isLoading ? '—' : String(branches.length),
          hint: 'Operating sites',
          tone: 'accent',
        },
        {
          label: 'Active',
          value: companiesQuery.isLoading
            ? '—'
            : String(companies.filter((c) => c.isActive).length),
          hint: 'Live companies',
          tone: 'neutral',
        },
      ]}
    >
      <AccessGuard
        permissions={VIEW}
        userRoles={roles}
        userPermissions={permissions}
        fallback={
          <WorkspaceEmptyState
            title="You don't have access to the organization"
            description="Ask an administrator for the 'View Organization' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Legal entities"
          title="Companies"
          description="Register the companies operating inside this tenant."
        >
          <DataTable
            columns={companyColumns}
            rows={companies}
            rowKey={(r) => r.id}
            isLoading={companiesQuery.isLoading}
            isError={companiesQuery.isError}
            emptyTitle="No companies yet"
            emptyDescription="Create your first company to anchor the org structure."
            emptyChildren={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditingCompany(null)
                    setCompanyDialog(true)
                  }}
                >
                  Create company
                </Button>
              ) : null
            }
            pageSize={10}
            exportFileName="hr-companies"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Sites"
          title="Branches"
          description="Branches belong to a company and can link to a warehouse or cost center."
        >
          <DataTable
            columns={branchColumns}
            rows={branches}
            rowKey={(r) => r.id}
            isLoading={branchesQuery.isLoading}
            isError={branchesQuery.isError}
            emptyTitle="No branches yet"
            emptyDescription="Add branches once at least one company exists."
            pageSize={10}
            exportFileName="hr-branches"
          />
        </WorkspacePanel>
      </AccessGuard>

      <CompanyDialog
        open={companyDialog}
        onOpenChange={setCompanyDialog}
        company={editingCompany}
      />
      <BranchDialog
        open={branchDialog}
        onOpenChange={setBranchDialog}
        branch={editingBranch}
      />

      <ConfirmDialog
        open={pendingCompany !== null}
        onOpenChange={(o) => {
          if (!o) setPendingCompany(null)
        }}
        title="Delete company?"
        description={
          pendingCompany
            ? `"${pendingCompany.name}" will be archived.`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={companyMut.remove.isPending}
        onConfirm={async () => {
          if (!pendingCompany) return
          try {
            await companyMut.remove.mutateAsync(pendingCompany.id)
            notifySuccess('Company deleted', pendingCompany.name)
            setPendingCompany(null)
          } catch (e: unknown) {
            notifyError(e, 'Could not delete the company')
          }
        }}
      />
      <ConfirmDialog
        open={pendingBranch !== null}
        onOpenChange={(o) => {
          if (!o) setPendingBranch(null)
        }}
        title="Delete branch?"
        description={
          pendingBranch
            ? `"${pendingBranch.name}" will be archived.`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={branchMut.remove.isPending}
        onConfirm={async () => {
          if (!pendingBranch) return
          try {
            await branchMut.remove.mutateAsync(pendingBranch.id)
            notifySuccess('Branch deleted', pendingBranch.name)
            setPendingBranch(null)
          } catch (e: unknown) {
            notifyError(e, 'Could not delete the branch')
          }
        }}
      />
    </WorkspacePage>
  )
}
