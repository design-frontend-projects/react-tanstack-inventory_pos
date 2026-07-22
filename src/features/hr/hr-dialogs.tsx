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
  useCompanies,
  useDepartments,
  useJobGrades,
  useOrganizationMutations,
} from '#/features/hr/use-organization'
import {
  branchWriteSchema,
  companyWriteSchema,
  costCenterWriteSchema,
  departmentWriteSchema,
  jobGradeWriteSchema,
  positionWriteSchema,
} from '#/features/hr/validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) {
    return null
  }
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {error}
    </p>
  )
}

function firstIssue(error: {
  issues: Array<{ path: Array<string | number>; message: string }>
}): string {
  const issue = error.issues[0]
  return `${issue.path.join('.') || 'form'}: ${issue.message}`
}

// --- Company ----------------------------------------------------------------

export type CompanyFormValues = {
  id: string
  code: string
  name: string
  nameAr: string | null
  currencyCode: string
  isActive: boolean
}

export function CompanyDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: CompanyFormValues | null
}) {
  const isEdit = company !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [nameAr, setNameAr] = React.useState('')
  const [currencyCode, setCurrencyCode] = React.useState('USD')
  const [error, setError] = React.useState<string | null>(null)
  const { company: mutations } = useOrganizationMutations()
  const isBusy = mutations.create.isPending || mutations.update.isPending

  React.useEffect(() => {
    if (open) {
      setCode(company?.code ?? '')
      setName(company?.name ?? '')
      setNameAr(company?.nameAr ?? '')
      setCurrencyCode(company?.currencyCode ?? 'USD')
      setError(null)
    }
  }, [open, company])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = companyWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      nameAr: nameAr.trim() || null,
      currencyCode: currencyCode.trim().toUpperCase() || 'USD',
    })
    if (!parsed.success) {
      setError(firstIssue(parsed.error))
      return
    }
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: company.id,
          input: parsed.data,
        })
        notifySuccess('Company updated', name)
      } else {
        await mutations.create.mutateAsync(parsed.data)
        notifySuccess('Company created', name)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not save the company')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit company' : 'New company'}</DialogTitle>
          <DialogDescription>
            Legal entities and operating companies in this tenant.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Currency">
              <Input
                value={currencyCode}
                maxLength={3}
                onChange={(e) => setCurrencyCode(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Name (Arabic)">
            <Input
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
            />
          </Field>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Branch -----------------------------------------------------------------

export type BranchFormValues = {
  id: string
  companyId: string
  code: string
  name: string
  branchType: string
  isActive: boolean
}

export function BranchDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: BranchFormValues | null
}) {
  const isEdit = branch !== null
  const [companyId, setCompanyId] = React.useState('')
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [branchType, setBranchType] = React.useState('office')
  const [error, setError] = React.useState<string | null>(null)
  const companiesQuery = useCompanies()
  const { branch: mutations } = useOrganizationMutations()
  const isBusy = mutations.create.isPending || mutations.update.isPending

  React.useEffect(() => {
    if (open) {
      setCompanyId(branch?.companyId ?? '')
      setCode(branch?.code ?? '')
      setName(branch?.name ?? '')
      setBranchType(branch?.branchType ?? 'office')
      setError(null)
    }
  }, [open, branch])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = branchWriteSchema.safeParse({
      companyId,
      code: code.trim(),
      name: name.trim(),
      branchType,
    })
    if (!parsed.success) {
      setError(firstIssue(parsed.error))
      return
    }
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: branch.id,
          input: parsed.data,
        })
        notifySuccess('Branch updated', name)
      } else {
        await mutations.create.mutateAsync(parsed.data)
        notifySuccess('Branch created', name)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not save the branch')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit branch' : 'New branch'}</DialogTitle>
          <DialogDescription>
            Physical or operational sites of a company.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Company">
            <select
              className={selectClassName}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Select a company…</option>
              {(companiesQuery.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Type">
              <select
                className={selectClassName}
                value={branchType}
                onChange={(e) => setBranchType(e.target.value)}
              >
                <option value="office">Office</option>
                <option value="store">Store</option>
                <option value="warehouse">Warehouse</option>
                <option value="factory">Factory</option>
                <option value="restaurant">Restaurant</option>
              </select>
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create branch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Department -------------------------------------------------------------

export type DepartmentFormValues = {
  id: string
  companyId: string
  parentDepartmentId: string | null
  code: string
  name: string
  isActive: boolean
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: DepartmentFormValues | null
}) {
  const isEdit = department !== null
  const [companyId, setCompanyId] = React.useState('')
  const [parentDepartmentId, setParentDepartmentId] = React.useState('')
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const companiesQuery = useCompanies()
  const departmentsQuery = useDepartments()
  const { department: mutations } = useOrganizationMutations()
  const isBusy = mutations.create.isPending || mutations.update.isPending

  React.useEffect(() => {
    if (open) {
      setCompanyId(department?.companyId ?? '')
      setParentDepartmentId(department?.parentDepartmentId ?? '')
      setCode(department?.code ?? '')
      setName(department?.name ?? '')
      setError(null)
    }
  }, [open, department])

  const parentOptions = (departmentsQuery.data ?? []).filter(
    (option) => option.id !== department?.id,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = departmentWriteSchema.safeParse({
      companyId,
      parentDepartmentId: parentDepartmentId || null,
      code: code.trim(),
      name: name.trim(),
    })
    if (!parsed.success) {
      setError(firstIssue(parsed.error))
      return
    }
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: department.id,
          input: parsed.data,
        })
        notifySuccess('Department updated', name)
      } else {
        await mutations.create.mutateAsync(parsed.data)
        notifySuccess('Department created', name)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not save the department')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit department' : 'New department'}
          </DialogTitle>
          <DialogDescription>
            Departments form the organization hierarchy. A department cannot be
            its own ancestor.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Company">
            <select
              className={selectClassName}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Select a company…</option>
              {(companiesQuery.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parent department (optional)">
            <select
              className={selectClassName}
              value={parentDepartmentId}
              onChange={(e) => setParentDepartmentId(e.target.value)}
            >
              <option value="">— Top level —</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Position ---------------------------------------------------------------

export type PositionFormValues = {
  id: string
  code: string
  title: string
  departmentId: string | null
  jobGradeId: string | null
  employmentType: string
  isManagerial: boolean
  isActive: boolean
}

export function PositionDialog({
  open,
  onOpenChange,
  position,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: PositionFormValues | null
}) {
  const isEdit = position !== null
  const [code, setCode] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [departmentId, setDepartmentId] = React.useState('')
  const [jobGradeId, setJobGradeId] = React.useState('')
  const [employmentType, setEmploymentType] = React.useState('full_time')
  const [isManagerial, setIsManagerial] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const departmentsQuery = useDepartments()
  const jobGradesQuery = useJobGrades()
  const { position: mutations } = useOrganizationMutations()
  const isBusy = mutations.create.isPending || mutations.update.isPending

  React.useEffect(() => {
    if (open) {
      setCode(position?.code ?? '')
      setTitle(position?.title ?? '')
      setDepartmentId(position?.departmentId ?? '')
      setJobGradeId(position?.jobGradeId ?? '')
      setEmploymentType(position?.employmentType ?? 'full_time')
      setIsManagerial(position?.isManagerial ?? false)
      setError(null)
    }
  }, [open, position])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = positionWriteSchema.safeParse({
      code: code.trim(),
      title: title.trim(),
      departmentId: departmentId || null,
      jobGradeId: jobGradeId || null,
      employmentType,
      isManagerial,
    })
    if (!parsed.success) {
      setError(firstIssue(parsed.error))
      return
    }
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: position.id,
          input: parsed.data,
        })
        notifySuccess('Position updated', title)
      } else {
        await mutations.create.mutateAsync(parsed.data)
        notifySuccess('Position created', title)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not save the position')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit position' : 'New position'}</DialogTitle>
          <DialogDescription>
            Job positions map employees to grades and departments.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Employment type">
              <select
                className={selectClassName}
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="intern">Intern</option>
              </select>
            </Field>
          </div>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select
                className={selectClassName}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">—</option>
                {(departmentsQuery.data ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job grade">
              <select
                className={selectClassName}
                value={jobGradeId}
                onChange={(e) => setJobGradeId(e.target.value)}
              >
                <option value="">—</option>
                {(jobGradesQuery.data ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isManagerial}
              onChange={(e) => setIsManagerial(e.target.checked)}
            />
            Managerial position
          </label>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create position'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Job grade --------------------------------------------------------------

export type JobGradeFormValues = {
  id: string
  code: string
  name: string
  gradeLevel: number
  minSalary: string | null
  maxSalary: string | null
  currencyCode: string
  isActive: boolean
}

export function JobGradeDialog({
  open,
  onOpenChange,
  jobGrade,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobGrade: JobGradeFormValues | null
}) {
  const isEdit = jobGrade !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [gradeLevel, setGradeLevel] = React.useState('1')
  const [minSalary, setMinSalary] = React.useState('')
  const [maxSalary, setMaxSalary] = React.useState('')
  const [currencyCode, setCurrencyCode] = React.useState('USD')
  const [error, setError] = React.useState<string | null>(null)
  const { jobGrade: mutations } = useOrganizationMutations()
  const isBusy = mutations.create.isPending || mutations.update.isPending

  React.useEffect(() => {
    if (open) {
      setCode(jobGrade?.code ?? '')
      setName(jobGrade?.name ?? '')
      setGradeLevel(String(jobGrade?.gradeLevel ?? 1))
      setMinSalary(jobGrade?.minSalary ?? '')
      setMaxSalary(jobGrade?.maxSalary ?? '')
      setCurrencyCode(jobGrade?.currencyCode ?? 'USD')
      setError(null)
    }
  }, [open, jobGrade])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = jobGradeWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      gradeLevel: Number(gradeLevel) || 1,
      minSalary: minSalary.trim() || null,
      maxSalary: maxSalary.trim() || null,
      currencyCode: currencyCode.trim().toUpperCase() || 'USD',
    })
    if (!parsed.success) {
      setError(firstIssue(parsed.error))
      return
    }
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: jobGrade.id,
          input: parsed.data,
        })
        notifySuccess('Job grade updated', name)
      } else {
        await mutations.create.mutateAsync(parsed.data)
        notifySuccess('Job grade created', name)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not save the job grade')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit job grade' : 'New job grade'}
          </DialogTitle>
          <DialogDescription>
            Grades define salary bands and leave entitlements.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Level">
              <Input
                type="number"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={currencyCode}
                maxLength={3}
                onChange={(e) => setCurrencyCode(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min salary">
              <Input
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
              />
            </Field>
            <Field label="Max salary">
              <Input
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
              />
            </Field>
          </div>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create job grade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Cost center ------------------------------------------------------------

export type CostCenterFormValues = {
  id: string
  code: string
  name: string
  parentId: string | null
  isActive: boolean
}

export function CostCenterDialog({
  open,
  onOpenChange,
  costCenter,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  costCenter: CostCenterFormValues | null
}) {
  const isEdit = costCenter !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [parentId, setParentId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { costCenter: mutations } = useOrganizationMutations()
  const isBusy = mutations.create.isPending || mutations.update.isPending

  React.useEffect(() => {
    if (open) {
      setCode(costCenter?.code ?? '')
      setName(costCenter?.name ?? '')
      setParentId(costCenter?.parentId ?? '')
      setError(null)
    }
  }, [open, costCenter])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = costCenterWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      parentId: parentId.trim() || null,
    })
    if (!parsed.success) {
      setError(firstIssue(parsed.error))
      return
    }
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          id: costCenter.id,
          input: parsed.data,
        })
        notifySuccess('Cost center updated', name)
      } else {
        await mutations.create.mutateAsync(parsed.data)
        notifySuccess('Cost center created', name)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not save the cost center')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit cost center' : 'New cost center'}
          </DialogTitle>
          <DialogDescription>
            Cost centers group HR expenses and map to finance dimensions.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create cost center'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
