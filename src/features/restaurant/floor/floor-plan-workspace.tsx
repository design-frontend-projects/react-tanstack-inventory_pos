'use client'

import * as React from 'react'
import { PencilLine, Plus, Trash2, UserPlus, X } from 'lucide-react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  AreaDialog,
  AssignStaffDialog,
  ConfirmDialog,
  SectionDialog,
  TableDialog,
} from '#/features/restaurant/floor/floor-plan-dialogs'
import type {
  AreaDialogValues,
  AssignStaffScope,
  SectionDialogValues,
  TableDialogValues,
} from '#/features/restaurant/floor/floor-plan-dialogs'
import {
  useDiningAreas,
  useFloorAssignments,
  useFloorMutations,
  useTables,
  useTableSections,
  useTenantMembers,
} from '#/features/restaurant/floor/use-floor'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

interface AssignDialogState {
  open: boolean
  scope: AssignStaffScope
  role: 'FLOOR_MANAGER' | 'WAITER'
  title: string
  description: string
}

interface ConfirmState {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<void>
}

function StaffChip({
  name,
  onRemove,
  tone = 'neutral',
}: {
  name: string
  onRemove?: () => void
  tone?: 'neutral' | 'manager'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        tone === 'manager'
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-muted/60 text-foreground',
      )}
    >
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 hover:bg-foreground/10"
          aria-label={`Remove ${name}`}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

export function FloorPlanWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canViewMembers = hasPermission(permissions, 'user.view')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const areasQuery = useDiningAreas(branchId)
  const sectionsQuery = useTableSections(branchId)
  const tablesQuery = useTables(branchId)
  const assignmentsQuery = useFloorAssignments(branchId)
  const membersQuery = useTenantMembers(canViewMembers)
  const mutations = useFloorMutations()
  useRestaurantRealtime()

  const areas = areasQuery.data ?? []
  const sections = sectionsQuery.data ?? []
  const tables = tablesQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []
  const members = (membersQuery.data ?? [])
    .filter(
      (member): member is typeof member & { profileId: string } =>
        member.status === 'active' && Boolean(member.profileId),
    )
    .map((member) => ({
      profileId: member.profileId,
      displayName: member.displayName || member.email,
      roleLabel: member.roleLabel,
    }))

  const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null)
  const selectedArea =
    areas.find((area) => area.id === selectedAreaId) ?? areas.at(0) ?? null

  const [areaDialog, setAreaDialog] = React.useState<{
    open: boolean
    area: AreaDialogValues | null
  }>({ open: false, area: null })
  const [sectionDialog, setSectionDialog] = React.useState<{
    open: boolean
    section: SectionDialogValues | null
  }>({ open: false, section: null })
  const [tableDialog, setTableDialog] = React.useState<{
    open: boolean
    sectionId: string | null
    table: TableDialogValues | null
  }>({ open: false, sectionId: null, table: null })
  const [assignDialog, setAssignDialog] = React.useState<AssignDialogState | null>(
    null,
  )
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const areaSections = selectedArea
    ? sections.filter((section) => section.diningAreaId === selectedArea.id)
    : []
  const tablesBySection = new Map<string, typeof tables>()
  for (const table of tables) {
    const bucket = tablesBySection.get(table.sectionId) ?? []
    bucket.push(table)
    tablesBySection.set(table.sectionId, bucket)
  }

  const areaAssignments = selectedArea
    ? assignments.filter((assignment) => assignment.diningAreaId === selectedArea.id)
    : []
  const floorManager = areaAssignments.find(
    (assignment) => assignment.role === 'FLOOR_MANAGER',
  )
  const areaWaiters = areaAssignments.filter(
    (assignment) =>
      assignment.role === 'WAITER' && !assignment.sectionId && !assignment.tableId,
  )
  const waitersForSection = (sectionId: string) =>
    areaAssignments.filter(
      (assignment) =>
        assignment.role === 'WAITER' &&
        assignment.sectionId === sectionId &&
        !assignment.tableId,
    )
  const waitersForTable = (tableId: string) =>
    areaAssignments.filter((assignment) => assignment.tableId === tableId)

  const removeAssignment = (id: string) => {
    mutations.removeAssignment.mutate(id)
  }

  const openAssign = (
    role: 'FLOOR_MANAGER' | 'WAITER',
    scope: Omit<AssignStaffScope, 'branchId'>,
    title: string,
    description: string,
  ) => {
    if (!branchId) {
      return
    }
    setAssignDialog({
      open: true,
      role,
      scope: { branchId, ...scope },
      title,
      description,
    })
  }

  const isLoading =
    areasQuery.isLoading || sectionsQuery.isLoading || tablesQuery.isLoading

  return (
    <AccessGuard
      permissions={['res.settings.manage', 'res.floor.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need the floor-management or restaurant-settings permission to define the floor plan."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Floor plan"
        title="Define floors, sections, and tables — and who runs them."
        description="Build the seating map the live floor, orders, and kitchen screens run on. Assign a floor manager per floor and waiters per floor, section, or table."
        actions={
          <>
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            <Button
              onClick={() => setAreaDialog({ open: true, area: null })}
              disabled={!branchId}
            >
              <Plus data-icon="inline-start" /> New floor
            </Button>
          </>
        }
        metrics={[
          {
            label: 'Floors',
            value: areasQuery.data ? String(areas.length) : '—',
            hint: 'Dining areas in this branch',
            tone: 'red',
          },
          {
            label: 'Tables',
            value: tablesQuery.data ? String(tables.length) : '—',
            hint: 'Across all sections',
            tone: 'neutral',
          },
          {
            label: 'Assigned staff',
            value: assignmentsQuery.data ? String(assignments.length) : '—',
            hint: 'Managers and waiters on duty scopes',
            tone: 'accent',
          },
        ]}
      >
        {!branchId ? (
          <WorkspaceEmptyState
            title="No branch found"
            description="Create a restaurant branch in restaurant settings before defining the floor plan."
          />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading floor plan…</p>
        ) : areas.length === 0 ? (
          <WorkspaceEmptyState
            title="No floors yet"
            description="Start by creating your first floor (dining area), then add sections and tables."
          >
            <Button onClick={() => setAreaDialog({ open: true, area: null })}>
              Create floor
            </Button>
          </WorkspaceEmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <WorkspacePanel
              eyebrow="Floors"
              title="Dining areas"
              className="h-fit"
            >
              <div className="flex flex-col gap-2">
                {areas.map((area) => {
                  const count = sections.filter(
                    (section) => section.diningAreaId === area.id,
                  ).length
                  const isSelected = selectedArea?.id === area.id
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setSelectedAreaId(area.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'border-primary/50 bg-primary/[0.06]'
                          : 'border-border bg-card hover:bg-muted/60',
                      )}
                    >
                      <span>
                        <span className="block font-semibold">{area.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {area.code} · {count} section{count === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </WorkspacePanel>

            {selectedArea ? (
              <WorkspacePanel
                eyebrow={`Floor · ${selectedArea.code}`}
                title={selectedArea.name}
                description="Sections, tables, and staff for this floor."
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setAreaDialog({
                        open: true,
                        area: {
                          id: selectedArea.id,
                          code: selectedArea.code,
                          name: selectedArea.name,
                          displayOrder: selectedArea.displayOrder,
                        },
                      })
                    }
                  >
                    <PencilLine data-icon="inline-start" /> Edit floor
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setConfirm({
                        open: true,
                        title: 'Delete floor?',
                        description: `“${selectedArea.name}” will be removed. Floors with sections cannot be deleted.`,
                        confirmLabel: 'Delete floor',
                        onConfirm: async () => {
                          await mutations.deleteDiningArea.mutateAsync(
                            selectedArea.id,
                          )
                          setSelectedAreaId(null)
                        },
                      })
                    }
                  >
                    <Trash2 data-icon="inline-start" /> Delete
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => setSectionDialog({ open: true, section: null })}
                  >
                    <Plus data-icon="inline-start" /> New section
                  </Button>
                </div>

                <div className="mb-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="ops-panel-label">Floor manager</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {floorManager ? (
                        <StaffChip
                          name={floorManager.displayName}
                          tone="manager"
                          onRemove={() => removeAssignment(floorManager.id)}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No manager assigned
                        </span>
                      )}
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={!canViewMembers}
                        onClick={() =>
                          openAssign(
                            'FLOOR_MANAGER',
                            { diningAreaId: selectedArea.id },
                            'Assign floor manager',
                            'One manager runs each floor — assigning a new one replaces the current manager.',
                          )
                        }
                      >
                        <UserPlus data-icon="inline-start" />
                        {floorManager ? 'Replace' : 'Assign'}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="ops-panel-label">Floor waiters</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {areaWaiters.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          No floor-wide waiters
                        </span>
                      ) : (
                        areaWaiters.map((waiter) => (
                          <StaffChip
                            key={waiter.id}
                            name={waiter.displayName}
                            onRemove={() => removeAssignment(waiter.id)}
                          />
                        ))
                      )}
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={!canViewMembers}
                        onClick={() =>
                          openAssign(
                            'WAITER',
                            { diningAreaId: selectedArea.id },
                            'Assign floor waiter',
                            'This waiter covers every section on the floor.',
                          )
                        }
                      >
                        <UserPlus data-icon="inline-start" /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                {!canViewMembers ? (
                  <p className="mb-4 text-xs text-muted-foreground">
                    Staff assignment needs the user-directory permission
                    (user.view) — ask an administrator to assign staff or grant
                    access.
                  </p>
                ) : null}

                {areaSections.length === 0 ? (
                  <WorkspaceEmptyState
                    title="No sections on this floor"
                    description="Add a section (e.g. Window, Patio, Bar) to start placing tables."
                  >
                    <Button
                      onClick={() => setSectionDialog({ open: true, section: null })}
                    >
                      Create section
                    </Button>
                  </WorkspaceEmptyState>
                ) : (
                  <div className="flex flex-col gap-4">
                    {areaSections.map((section) => {
                      const sectionTables = tablesBySection.get(section.id) ?? []
                      const sectionWaiters = waitersForSection(section.id)
                      return (
                        <article key={section.id} className="pin-card p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">
                                {section.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {section.code} · {sectionTables.length} table
                                {sectionTables.length === 1 ? '' : 's'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  setSectionDialog({
                                    open: true,
                                    section: {
                                      id: section.id,
                                      code: section.code,
                                      name: section.name,
                                      displayOrder: section.displayOrder,
                                    },
                                  })
                                }
                              >
                                <PencilLine />
                                <span className="sr-only">Edit section</span>
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() =>
                                  setConfirm({
                                    open: true,
                                    title: 'Delete section?',
                                    description: `“${section.name}” will be removed. Sections with tables cannot be deleted.`,
                                    confirmLabel: 'Delete section',
                                    onConfirm: async () => {
                                      await mutations.deleteSection.mutateAsync(
                                        section.id,
                                      )
                                    },
                                  })
                                }
                              >
                                <Trash2 />
                                <span className="sr-only">Delete section</span>
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={!canViewMembers}
                                onClick={() =>
                                  openAssign(
                                    'WAITER',
                                    {
                                      diningAreaId: selectedArea.id,
                                      sectionId: section.id,
                                    },
                                    `Assign waiter — ${section.name}`,
                                    'This waiter covers every table in the section.',
                                  )
                                }
                              >
                                <UserPlus data-icon="inline-start" /> Waiter
                              </Button>
                              <Button
                                size="xs"
                                onClick={() =>
                                  setTableDialog({
                                    open: true,
                                    sectionId: section.id,
                                    table: null,
                                  })
                                }
                              >
                                <Plus data-icon="inline-start" /> Table
                              </Button>
                            </div>
                          </div>

                          {sectionWaiters.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {sectionWaiters.map((waiter) => (
                                <StaffChip
                                  key={waiter.id}
                                  name={waiter.displayName}
                                  onRemove={() => removeAssignment(waiter.id)}
                                />
                              ))}
                            </div>
                          ) : null}

                          {sectionTables.length > 0 ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                              {sectionTables.map((table) => {
                                const tableWaiters = waitersForTable(table.id)
                                return (
                                  <div
                                    key={table.id}
                                    className="rounded-xl border border-border bg-card p-3"
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <button
                                        type="button"
                                        className="text-left"
                                        onClick={() =>
                                          setTableDialog({
                                            open: true,
                                            sectionId: section.id,
                                            table: {
                                              id: table.id,
                                              code: table.code,
                                              seats: table.seats,
                                              minCapacity: table.minCapacity,
                                              shape: table.shape,
                                            },
                                          })
                                        }
                                      >
                                        <span className="block text-sm font-bold">
                                          {table.code}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {table.seats} seats
                                          {table.shape ? ` · ${table.shape}` : ''}
                                        </span>
                                      </button>
                                      <div className="flex gap-0.5">
                                        <Button
                                          size="icon-xs"
                                          variant="ghost"
                                          disabled={!canViewMembers}
                                          onClick={() =>
                                            openAssign(
                                              'WAITER',
                                              {
                                                diningAreaId: selectedArea.id,
                                                sectionId: section.id,
                                                tableId: table.id,
                                              },
                                              `Assign waiter — table ${table.code}`,
                                              'This waiter owns this specific table.',
                                            )
                                          }
                                        >
                                          <UserPlus />
                                          <span className="sr-only">
                                            Assign waiter
                                          </span>
                                        </Button>
                                        <Button
                                          size="icon-xs"
                                          variant="ghost"
                                          onClick={() =>
                                            setConfirm({
                                              open: true,
                                              title: `Delete table ${table.code}?`,
                                              description:
                                                'Tables with an active order cannot be deleted.',
                                              confirmLabel: 'Delete table',
                                              onConfirm: async () => {
                                                await mutations.deleteTable.mutateAsync(
                                                  table.id,
                                                )
                                              },
                                            })
                                          }
                                        >
                                          <Trash2 />
                                          <span className="sr-only">
                                            Delete table
                                          </span>
                                        </Button>
                                      </div>
                                    </div>
                                    {tableWaiters.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {tableWaiters.map((waiter) => (
                                          <StaffChip
                                            key={waiter.id}
                                            name={waiter.displayName}
                                            onRemove={() =>
                                              removeAssignment(waiter.id)
                                            }
                                          />
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">
                              No tables yet — add the first one.
                            </p>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </WorkspacePanel>
            ) : null}
          </div>
        )}

        {branchId ? (
          <>
            <AreaDialog
              open={areaDialog.open}
              onOpenChange={(open) =>
                setAreaDialog((previous) => ({ ...previous, open }))
              }
              branchId={branchId}
              area={areaDialog.area}
            />
            {selectedArea ? (
              <SectionDialog
                open={sectionDialog.open}
                onOpenChange={(open) =>
                  setSectionDialog((previous) => ({ ...previous, open }))
                }
                branchId={branchId}
                diningAreaId={selectedArea.id}
                section={sectionDialog.section}
              />
            ) : null}
            {tableDialog.sectionId ? (
              <TableDialog
                open={tableDialog.open}
                onOpenChange={(open) =>
                  setTableDialog((previous) => ({ ...previous, open }))
                }
                branchId={branchId}
                sectionId={tableDialog.sectionId}
                table={tableDialog.table}
              />
            ) : null}
            {assignDialog ? (
              <AssignStaffDialog
                open={assignDialog.open}
                onOpenChange={(open) =>
                  setAssignDialog((previous) =>
                    previous ? { ...previous, open } : previous,
                  )
                }
                scope={assignDialog.scope}
                role={assignDialog.role}
                title={assignDialog.title}
                description={assignDialog.description}
                members={members}
              />
            ) : null}
            {confirm ? (
              <ConfirmDialog
                open={confirm.open}
                onOpenChange={(open) =>
                  setConfirm((previous) =>
                    previous ? { ...previous, open } : previous,
                  )
                }
                title={confirm.title}
                description={confirm.description}
                confirmLabel={confirm.confirmLabel}
                onConfirm={confirm.onConfirm}
                isPending={
                  mutations.deleteDiningArea.isPending ||
                  mutations.deleteSection.isPending ||
                  mutations.deleteTable.isPending
                }
              />
            ) : null}
          </>
        ) : null}
      </WorkspacePage>
    </AccessGuard>
  )
}
