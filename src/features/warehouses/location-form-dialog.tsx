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
import {
  useLocationMutations,
  useLocations,
} from '#/features/warehouses/use-warehouses'
import { locationWriteSchema } from '#/features/warehouses/validation'

export type LocationFormValues = {
  id: string
  code: string
  name: string
  locationType: string
  parentId: string | null
  isStockable: boolean
  isPickable: boolean
  pickSequence: number | null
  isActive: boolean
}

const LOCATION_TYPES = [
  'ZONE',
  'AISLE',
  'RACK',
  'SHELF',
  'BIN',
  'DOCK',
  'STAGING',
]

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

export function LocationFormDialog({
  open,
  onOpenChange,
  warehouseId,
  location,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouseId: string | null
  location: LocationFormValues | null
}) {
  const isEdit = location !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [locationType, setLocationType] = React.useState('BIN')
  const [parentId, setParentId] = React.useState('')
  const [pickSequence, setPickSequence] = React.useState('')
  const [isStockable, setIsStockable] = React.useState(true)
  const [isPickable, setIsPickable] = React.useState(true)
  const [isActive, setIsActive] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const locationsQuery = useLocations(warehouseId)
  const { createLocation, updateLocation, deleteLocation } =
    useLocationMutations()
  const isBusy =
    createLocation.isPending ||
    updateLocation.isPending ||
    deleteLocation.isPending

  React.useEffect(() => {
    if (open) {
      setCode(location?.code ?? '')
      setName(location?.name ?? '')
      setLocationType(location?.locationType ?? 'BIN')
      setParentId(location?.parentId ?? '')
      setPickSequence(
        location?.pickSequence === null || location?.pickSequence === undefined
          ? ''
          : String(location.pickSequence),
      )
      setIsStockable(location?.isStockable ?? true)
      setIsPickable(location?.isPickable ?? true)
      setIsActive(location?.isActive ?? true)
      setError(null)
    }
  }, [open, location])

  // A location cannot parent itself; deeper cycles are rejected server-side.
  const parentOptions = (locationsQuery.data ?? []).filter(
    (option) => option.id !== location?.id,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!warehouseId) {
      setError('Select a warehouse first.')
      return
    }

    const parsed = locationWriteSchema.safeParse({
      warehouseId,
      code: code.trim(),
      name: name.trim(),
      locationType,
      parentId: parentId || null,
      isStockable,
      isPickable,
      pickSequence: pickSequence.trim() === '' ? null : Number(pickSequence),
      isActive,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        const { warehouseId: _omit, ...input } = parsed.data
        await updateLocation.mutateAsync({ id: location.id, input })
      } else {
        await createLocation.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save the location.',
      )
    }
  }

  async function handleDelete() {
    if (!isEdit) {
      return
    }

    setError(null)
    try {
      await deleteLocation.mutateAsync(location.id)
      onOpenChange(false)
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the location.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit location' : 'New location'}</DialogTitle>
          <DialogDescription>
            Locations form the storage hierarchy inside a warehouse — zones,
            aisles, racks, shelves, and bins.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="A-01-BIN-03"
                required
              />
            </Field>
            <Field label="Type">
              <select
                value={locationType}
                onChange={(event) => setLocationType(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
              >
                {LOCATION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Name *">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Aisle A shelf 1 bin 3"
              required
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Parent location">
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
              >
                <option value="">Top level</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pick sequence">
              <Input
                inputMode="numeric"
                value={pickSequence}
                onChange={(event) => setPickSequence(event.target.value)}
                placeholder="10"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isStockable}
                onChange={(event) => setIsStockable(event.target.checked)}
                className="size-4 accent-primary"
              />
              Stockable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPickable}
                onChange={(event) => setIsPickable(event.target.checked)}
                className="size-4 accent-primary"
              />
              Pickable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="size-4 accent-primary"
              />
              Active
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-2">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isBusy}
                onClick={handleDelete}
                className="sm:mr-auto"
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
