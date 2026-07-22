'use client'

import * as React from 'react'
import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
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
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { Field } from '#/features/hr/hr-dialogs'
import {
  candidateWriteSchema,
  jobOfferWriteSchema,
  jobOpeningWriteSchema,
} from '#/features/hr/recruitment-validation'
import {
  useCandidates,
  useJobOffers,
  useJobOpenings,
  useRecruitmentMutations,
} from '#/features/hr/use-recruitment'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.recruitment_view']
const MANAGE = ['hr.recruitment_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type OpeningRow = NonNullable<ReturnType<typeof useJobOpenings>['data']>[number]
type CandidateRow = NonNullable<
  ReturnType<typeof useCandidates>['data']
>[number]
type OfferRow = NonNullable<ReturnType<typeof useJobOffers>['data']>[number]

const OPENING_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  draft: 'neutral',
  open: 'success',
  closed: 'neutral',
}

const STAGE_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  applied: 'neutral',
  screening: 'info',
  interview: 'warning',
  offer: 'info',
  hired: 'success',
}

const OFFER_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  draft: 'neutral',
  sent: 'warning',
  accepted: 'info',
  declined: 'danger',
  expired: 'neutral',
  hired: 'success',
}

const STAGE_ORDER = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
] as const

function nextStage(
  stage: string,
): 'screening' | 'interview' | 'offer' | 'hired' | null {
  const index = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number])
  if (index < 0 || index >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[index + 1] as 'screening' | 'interview' | 'offer' | 'hired'
}

// --- New opening dialog -----------------------------------------------------

function OpeningDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [title, setTitle] = React.useState('')
  const [employmentType, setEmploymentType] = React.useState('full_time')
  const [vacancies, setVacancies] = React.useState('1')
  const [salaryMin, setSalaryMin] = React.useState('')
  const [salaryMax, setSalaryMax] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createOpening } = useRecruitmentMutations()

  React.useEffect(() => {
    if (open) {
      setTitle('')
      setEmploymentType('full_time')
      setVacancies('1')
      setSalaryMin('')
      setSalaryMax('')
      setDescription('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = jobOpeningWriteSchema.safeParse({
      title: title.trim(),
      employmentType,
      vacancies: Number(vacancies) || 1,
      salaryMin: salaryMin.trim() || null,
      salaryMax: salaryMax.trim() || null,
      description: description.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createOpening.mutateAsync(parsed.data)
      notifySuccess('Opening created', 'A requisition number was assigned.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the opening')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New job opening</DialogTitle>
          <DialogDescription>
            Openings are created as drafts. Open them to start receiving
            candidates.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Vacancies">
              <Input
                type="number"
                min={1}
                value={vacancies}
                onChange={(e) => setVacancies(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salary min">
              <Input
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
              />
            </Field>
            <Field label="Salary max">
              <Input
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createOpening.isPending}>
              Create opening
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- New candidate dialog ---------------------------------------------------

function CandidateDialog({
  open,
  onOpenChange,
  openings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  openings: Array<OpeningRow>
}) {
  const [jobOpeningId, setJobOpeningId] = React.useState('')
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [source, setSource] = React.useState('')
  const [expectedSalary, setExpectedSalary] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createCandidate } = useRecruitmentMutations()

  React.useEffect(() => {
    if (open) {
      setJobOpeningId('')
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setSource('')
      setExpectedSalary('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = candidateWriteSchema.safeParse({
      jobOpeningId: jobOpeningId || null,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      source: source.trim() || null,
      expectedSalary: expectedSalary.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createCandidate.mutateAsync(parsed.data)
      notifySuccess('Candidate added', 'Added to the applied stage.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not add the candidate')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New candidate</DialogTitle>
          <DialogDescription>
            Candidates enter the pipeline at the applied stage with a generated
            code.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Job opening (optional)">
            <select
              className={selectClassName}
              value={jobOpeningId}
              onChange={(e) => setJobOpeningId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {openings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.requisitionNo} · {o.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
            <Field label="Expected salary">
              <Input
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
              />
            </Field>
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCandidate.isPending}>
              Add candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- New offer dialog -------------------------------------------------------

function OfferDialog({
  open,
  onOpenChange,
  candidates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: Array<CandidateRow>
}) {
  const [candidateId, setCandidateId] = React.useState('')
  const [offeredSalary, setOfferedSalary] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createOffer } = useRecruitmentMutations()

  React.useEffect(() => {
    if (open) {
      setCandidateId('')
      setOfferedSalary('')
      setStartDate('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = jobOfferWriteSchema.safeParse({
      candidateId,
      offeredSalary: offeredSalary.trim() || undefined,
      startDate: startDate || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createOffer.mutateAsync(parsed.data)
      notifySuccess('Offer created', 'An offer number was assigned.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the offer')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New job offer</DialogTitle>
          <DialogDescription>
            Creating an offer moves the candidate into the offer stage.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Candidate">
            <select
              className={selectClassName}
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
            >
              <option value="">Select a candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.candidateCode} · {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Offered salary">
              <Input
                value={offeredSalary}
                onChange={(e) => setOfferedSalary(e.target.value)}
              />
            </Field>
            <Field label="Start date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createOffer.isPending}>
              Create offer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Workspace --------------------------------------------------------------

export function RecruitmentWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [openingDialog, setOpeningDialog] = React.useState(false)
  const [candidateDialog, setCandidateDialog] = React.useState(false)
  const [offerDialog, setOfferDialog] = React.useState(false)

  const openingsQuery = useJobOpenings()
  const candidatesQuery = useCandidates()
  const offersQuery = useJobOffers()
  const {
    setOpeningStatus,
    deleteOpening,
    advanceCandidate,
    setOfferStatus,
    recordAcceptance,
    hireCandidate,
  } = useRecruitmentMutations()

  const openings = openingsQuery.data ?? []
  const candidates = candidatesQuery.data ?? []
  const offers = offersQuery.data ?? []

  const candidateName = (id: string) => {
    const c = candidates.find((x) => x.id === id)
    return c ? `${c.firstName} ${c.lastName}` : '—'
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      notifySuccess(success, '')
    } catch (e: unknown) {
      notifyError(e, 'Action failed')
    }
  }

  const openingColumns: DataTableColumn<OpeningRow>[] = [
    {
      id: 'req',
      header: 'Requisition',
      cell: (r) => <span className="font-mono text-xs">{r.requisitionNo}</span>,
      sortValue: (r) => r.requisitionNo,
    },
    {
      id: 'title',
      header: 'Title',
      alwaysVisible: true,
      cell: (r) => r.title,
      sortValue: (r) => r.title,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => r.employmentType,
      sortValue: (r) => r.employmentType,
    },
    {
      id: 'vac',
      header: 'Vacancies',
      align: 'end',
      cell: (r) => r.vacancies,
      sortValue: (r) => r.vacancies,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={OPENING_TONES[r.statusCode] ?? 'neutral'}>
          {r.statusCode}
        </StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            {r.statusCode !== 'open' ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  run(
                    () =>
                      setOpeningStatus.mutateAsync({
                        id: r.id,
                        action: 'open',
                      }),
                    'Opening opened',
                  )
                }
              >
                Open
              </Button>
            ) : (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  run(
                    () =>
                      setOpeningStatus.mutateAsync({
                        id: r.id,
                        action: 'close',
                      }),
                    'Opening closed',
                  )
                }
              >
                Close
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                run(() => deleteOpening.mutateAsync(r.id), 'Opening deleted')
              }
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ]

  const candidateColumns: DataTableColumn<CandidateRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.candidateCode}</span>,
      sortValue: (r) => r.candidateCode,
    },
    {
      id: 'name',
      header: 'Candidate',
      alwaysVisible: true,
      cell: (r) => `${r.firstName} ${r.lastName}`,
      sortValue: (r) => `${r.firstName} ${r.lastName}`,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (r) => r.email ?? '—',
      sortValue: (r) => r.email ?? '',
    },
    {
      id: 'stage',
      header: 'Stage',
      cell: (r) => (
        <StatusChip
          tone={
            r.statusCode === 'rejected'
              ? 'danger'
              : (STAGE_TONES[r.stageCode] ?? 'neutral')
          }
        >
          {r.statusCode === 'rejected' ? 'rejected' : r.stageCode}
        </StatusChip>
      ),
      sortValue: (r) => r.stageCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) => {
        if (!canManage) return null
        if (r.stageCode === 'hired' || r.statusCode === 'rejected') return null
        const next = nextStage(r.stageCode)
        return (
          <div className="flex justify-end gap-1.5">
            {next ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  run(
                    () =>
                      advanceCandidate.mutateAsync({
                        id: r.id,
                        targetStage: next,
                      }),
                    `Moved to ${next}`,
                  )
                }
              >
                Advance to {next}
              </Button>
            ) : null}
            <Button
              size="xs"
              variant="destructive"
              onClick={() =>
                run(
                  () =>
                    advanceCandidate.mutateAsync({
                      id: r.id,
                      targetStage: 'rejected',
                    }),
                  'Candidate rejected',
                )
              }
            >
              Reject
            </Button>
          </div>
        )
      },
    },
  ]

  const offerColumns: DataTableColumn<OfferRow>[] = [
    {
      id: 'num',
      header: 'Offer',
      cell: (r) => <span className="font-mono text-xs">{r.offerNumber}</span>,
      sortValue: (r) => r.offerNumber,
    },
    {
      id: 'cand',
      header: 'Candidate',
      alwaysVisible: true,
      cell: (r) => candidateName(r.candidateId),
      sortValue: (r) => candidateName(r.candidateId),
    },
    {
      id: 'salary',
      header: 'Salary',
      align: 'end',
      cell: (r) => r.offeredSalary,
      sortValue: (r) => Number(r.offeredSalary),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={OFFER_TONES[r.statusCode] ?? 'neutral'}>
          {r.statusCode}
        </StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) => {
        if (!canManage) return null
        return (
          <div className="flex justify-end gap-1.5">
            {r.statusCode === 'draft' ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  run(
                    () =>
                      setOfferStatus.mutateAsync({
                        id: r.id,
                        statusCode: 'sent',
                      }),
                    'Offer sent',
                  )
                }
              >
                Send
              </Button>
            ) : null}
            {r.statusCode === 'sent' ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  run(
                    () =>
                      recordAcceptance.mutateAsync({
                        offerId: r.id,
                        decision: 'accepted',
                      }),
                    'Offer accepted',
                  )
                }
              >
                Accept
              </Button>
            ) : null}
            {r.statusCode === 'accepted' ? (
              <Button
                size="xs"
                onClick={() =>
                  run(() => hireCandidate.mutateAsync(r.id), 'Candidate hired')
                }
              >
                Hire
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  const openCount = openings.filter((o) => o.statusCode === 'open').length
  const activeCandidates = candidates.filter(
    (c) => c.stageCode !== 'hired' && c.statusCode !== 'rejected',
  ).length
  const openOffers = offers.filter(
    (o) => !['declined', 'expired', 'hired'].includes(o.statusCode),
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Recruitment"
      title="Run hiring from vacancy to signed offer."
      description="Post openings, move candidates through the pipeline, and convert accepted offers into employees — one applicant tracking system."
      actions={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOpeningDialog(true)}>
              New opening
            </Button>
            <Button onClick={() => setCandidateDialog(true)}>
              New candidate
            </Button>
            <Button variant="outline" onClick={() => setOfferDialog(true)}>
              New offer
            </Button>
          </div>
        ) : null
      }
      metrics={[
        {
          label: 'Open vacancies',
          value: openingsQuery.isLoading ? '—' : String(openCount),
          hint: 'Accepting candidates',
          tone: 'red',
        },
        {
          label: 'Active candidates',
          value: candidatesQuery.isLoading ? '—' : String(activeCandidates),
          hint: 'In pipeline',
          tone: 'accent',
        },
        {
          label: 'Open offers',
          value: offersQuery.isLoading ? '—' : String(openOffers),
          hint: 'Awaiting outcome',
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
            title="No access"
            description="Ask for the 'View Recruitment' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Vacancies"
          title="Job openings"
          description="Open a draft to start receiving candidates."
        >
          <DataTable
            columns={openingColumns}
            rows={openings}
            rowKey={(r) => r.id}
            isLoading={openingsQuery.isLoading}
            isError={openingsQuery.isError}
            emptyTitle="No job openings"
            emptyDescription="Create an opening to begin hiring."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setOpeningDialog(true)}>
                  New opening
                </Button>
              ) : null
            }
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-job-openings"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Pipeline"
          title="Candidates"
          description="Advance candidates one stage at a time, or reject them."
        >
          <DataTable
            columns={candidateColumns}
            rows={candidates}
            rowKey={(r) => r.id}
            isLoading={candidatesQuery.isLoading}
            isError={candidatesQuery.isError}
            emptyTitle="No candidates"
            emptyDescription="Add a candidate to the pipeline."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setCandidateDialog(true)}>
                  New candidate
                </Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-candidates"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Offers"
          title="Job offers"
          description="Send offers, record acceptance, and hire on acceptance."
        >
          <DataTable
            columns={offerColumns}
            rows={offers}
            rowKey={(r) => r.id}
            isLoading={offersQuery.isLoading}
            isError={offersQuery.isError}
            emptyTitle="No offers"
            emptyDescription="Create an offer for a candidate in the offer stage."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setOfferDialog(true)}>New offer</Button>
              ) : null
            }
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-job-offers"
          />
        </WorkspacePanel>
      </AccessGuard>

      <OpeningDialog open={openingDialog} onOpenChange={setOpeningDialog} />
      <CandidateDialog
        open={candidateDialog}
        onOpenChange={setCandidateDialog}
        openings={openings}
      />
      <OfferDialog
        open={offerDialog}
        onOpenChange={setOfferDialog}
        candidates={candidates}
      />
    </WorkspacePage>
  )
}
