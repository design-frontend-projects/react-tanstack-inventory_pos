'use client'

import * as React from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { useFloorMutations } from '#/features/restaurant/floor/use-floor'
import { errorMessage } from '#/features/restaurant/shared/format'

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

const TABLE_SHAPES = ['square', 'round', 'rectangle', 'booth', 'bar']

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null
  }
  return <p className="text-sm text-destructive">{message}</p>
}

// --- Dining area -------------------------------------------------------------

export interface AreaDialogValues {
  id: string
  code: string
  name: string
  displayOrder: number
}

export function AreaDialog({
  open,
  onOpenChange,
  branchId,
  area,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  area: AreaDialogValues | null
}) {
  const { createDiningArea, updateDiningArea } = useFloorMutations()
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [displayOrder, setDisplayOrder] = React.useState('0')
  const [error, setError] = React.useState<string | null>(null)
  const isBusy = createDiningArea.isPending || updateDiningArea.isPending

  React.useEffect(() => {
    if (open) {
      setCode(area?.code ?? '')
      setName(area?.name ?? '')
      setDisplayOrder(String(area?.displayOrder ?? 0))
      setError(null)
    }
  }, [open, area])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    try {
      if (area) {
        await updateDiningArea.mutateAsync({
          id: area.id,
          input: {
            code: code.trim(),
            name: name.trim(),
            displayOrder: Number(displayOrder) || 0,
          },
        })
      } else {
        await createDiningArea.mutateAsync({
          branchId,
          code: code.trim(),
          name: name.trim(),
          displayOrder: Number(displayOrder) || 0,
        })
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{area ? 'Edit floor' : 'New floor'}</DialogTitle>
          <DialogDescription>
            A floor (dining area) groups sections and tables — e.g. Ground
            floor, Terrace, Rooftop.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="GF"
                required
              />
            </Field>
            <Field label="Display order">
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ground floor"
              required
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {area ? 'Save floor' : 'Create floor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Section -----------------------------------------------------------------

export interface SectionDialogValues {
  id: string
  code: string
  name: string
  displayOrder: number
}

export function SectionDialog({
  open,
  onOpenChange,
  branchId,
  diningAreaId,
  section,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  diningAreaId: string
  section: SectionDialogValues | null
}) {
  const { createSection, updateSection } = useFloorMutations()
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [displayOrder, setDisplayOrder] = React.useState('0')
  const [error, setError] = React.useState<string | null>(null)
  const isBusy = createSection.isPending || updateSection.isPending

  React.useEffect(() => {
    if (open) {
      setCode(section?.code ?? '')
      setName(section?.name ?? '')
      setDisplayOrder(String(section?.displayOrder ?? 0))
      setError(null)
    }
  }, [open, section])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    try {
      if (section) {
        await updateSection.mutateAsync({
          id: section.id,
          input: {
            code: code.trim(),
            name: name.trim(),
            displayOrder: Number(displayOrder) || 0,
          },
        })
      } else {
        await createSection.mutateAsync({
          branchId,
          diningAreaId,
          code: code.trim(),
          name: name.trim(),
          displayOrder: Number(displayOrder) || 0,
        })
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{section ? 'Edit section' : 'New section'}</DialogTitle>
          <DialogDescription>
            Sections split a floor into service zones — e.g. Window, Patio, Bar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="WIN"
                required
              />
            </Field>
            <Field label="Display order">
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Window side"
              required
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {section ? 'Save section' : 'Create section'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Table -------------------------------------------------------------------

export interface TableDialogValues {
  id: string
  code: string
  seats: number
  minCapacity: number | null
  shape: string | null
}

export function TableDialog({
  open,
  onOpenChange,
  branchId,
  sectionId,
  table,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  sectionId: string
  table: TableDialogValues | null
}) {
  const { createTable, updateTable } = useFloorMutations()
  const [code, setCode] = React.useState('')
  const [seats, setSeats] = React.useState('2')
  const [minCapacity, setMinCapacity] = React.useState('')
  const [shape, setShape] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const isBusy = createTable.isPending || updateTable.isPending

  React.useEffect(() => {
    if (open) {
      setCode(table?.code ?? '')
      setSeats(String(table?.seats ?? 2))
      setMinCapacity(table?.minCapacity ? String(table.minCapacity) : '')
      setShape(table?.shape ?? '')
      setError(null)
    }
  }, [open, table])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const payload = {
      code: code.trim(),
      seats: Number(seats) || 2,
      minCapacity: minCapacity.trim() === '' ? null : Number(minCapacity),
      shape: shape.trim() === '' ? null : shape.trim(),
    }

    try {
      if (table) {
        await updateTable.mutateAsync({ id: table.id, input: payload })
      } else {
        await createTable.mutateAsync({ branchId, sectionId, ...payload })
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{table ? 'Edit table' : 'New table'}</DialogTitle>
          <DialogDescription>
            Table codes must be unique per branch — they are what waiters and
            the kitchen see.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="T1"
                required
              />
            </Field>
            <Field label="Shape">
              <select
                value={shape}
                onChange={(event) => setShape(event.target.value)}
                className={selectClassName}
              >
                <option value="">Any</option>
                {TABLE_SHAPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seats">
              <Input
                type="number"
                min={1}
                max={100}
                value={seats}
                onChange={(event) => setSeats(event.target.value)}
                required
              />
            </Field>
            <Field label="Min guests (optional)">
              <Input
                type="number"
                min={1}
                max={100}
                value={minCapacity}
                onChange={(event) => setMinCapacity(event.target.value)}
              />
            </Field>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {table ? 'Save table' : 'Create table'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Staff assignment --------------------------------------------------------

export interface AssignStaffScope {
  branchId: string
  diningAreaId: string
  sectionId?: string | null
  tableId?: string | null
}

export function AssignStaffDialog({
  open,
  onOpenChange,
  scope,
  role,
  title,
  description,
  members,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: AssignStaffScope
  role: 'FLOOR_MANAGER' | 'WAITER'
  title: string
  description: string
  members: Array<{ profileId: string; displayName: string; roleLabel?: string | null }>
}) {
  const { upsertAssignment } = useFloorMutations()
  const [profileId, setProfileId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setProfileId('')
      setError(null)
    }
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profileId) {
      return
    }
    setError(null)

    try {
      await upsertAssignment.mutateAsync({
        branchId: scope.branchId,
        diningAreaId: scope.diningAreaId,
        sectionId: scope.sectionId ?? null,
        tableId: scope.tableId ?? null,
        profileId,
        role,
      })
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Team member">
            <select
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              className={selectClassName}
              required
            >
              <option value="">Select a member…</option>
              {members.map((member) => (
                <option key={member.profileId} value={member.profileId}>
                  {member.displayName}
                  {member.roleLabel ? ` — ${member.roleLabel}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={upsertAssignment.isPending || !profileId}>
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Delete confirmation -----------------------------------------------------

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  isPending: boolean
}) {
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setError(null)
    }
  }, [open])

  const confirm = async () => {
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (confirmError: unknown) {
      setError(errorMessage(confirmError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
