'use client'

import { cn } from '#/lib/utils'

interface BranchPickerBranch {
  id: string
  name: string
  code: string
}

interface BranchPickerProps {
  branches: Array<BranchPickerBranch>
  branchId: string | null
  onChange: (branchId: string) => void
  className?: string
}

export function BranchPicker({
  branches,
  branchId,
  onChange,
  className,
}: BranchPickerProps) {
  if (branches.length <= 1) {
    return null
  }

  return (
    <select
      value={branchId ?? ''}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 rounded-full border border-border bg-card px-3 text-sm font-medium',
        className,
      )}
      aria-label="Branch"
    >
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  )
}
