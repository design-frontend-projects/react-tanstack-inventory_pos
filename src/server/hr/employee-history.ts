// Pure helper for the employee-history invariant (BR-EMP-1): every material
// change to an employee appends a history row — records are never overwritten.
// Kept Prisma-free so the diff logic is exhaustively unit-testable; the service
// persists the returned entries inside the same transaction as the update.

export interface TrackedField {
  key: string
  changeType: string
  label: string
}

// The employee fields whose change is materially significant and each get their
// own timeline entry.
export const TRACKED_FIELDS: ReadonlyArray<TrackedField> = [
  { key: 'departmentId', changeType: 'transfer', label: 'department' },
  { key: 'positionId', changeType: 'position_change', label: 'position' },
  { key: 'jobGradeId', changeType: 'grade_change', label: 'job grade' },
  { key: 'managerId', changeType: 'manager_change', label: 'manager' },
  { key: 'branchId', changeType: 'transfer', label: 'branch' },
  {
    key: 'costCenterId',
    changeType: 'cost_center_change',
    label: 'cost center',
  },
  {
    key: 'employmentStatus',
    changeType: 'status_change',
    label: 'employment status',
  },
  {
    key: 'employmentType',
    changeType: 'status_change',
    label: 'employment type',
  },
  { key: 'workLocation', changeType: 'transfer', label: 'work location' },
]

export interface HistoryEntry {
  changeType: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

function normalize(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

// Returns one history entry per tracked field that actually changed. A field
// absent from `input` (undefined) is untouched and produces no entry.
export function computeHistoryEntries(
  existing: Record<string, unknown>,
  input: Record<string, unknown>,
): Array<HistoryEntry> {
  const entries: Array<HistoryEntry> = []

  for (const field of TRACKED_FIELDS) {
    if (input[field.key] === undefined) {
      continue
    }

    const before = existing[field.key]
    const after = input[field.key]
    if (normalize(before) === normalize(after)) {
      continue
    }

    entries.push({
      changeType: field.changeType,
      fieldName: field.label,
      oldValue: before === null || before === undefined ? null : String(before),
      newValue: after === null || after === undefined ? null : String(after),
    })
  }

  return entries
}
