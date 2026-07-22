import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import {
  buildForest,
  computeDepth,
  wouldCreateCycle,
} from '#/server/hr/org-tree'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as orgRepo from '#/server/repos/hr-organization-repo'
import type { CurrentUserContext } from '#/types/auth'

// Service layer for the HR organization masters. Handlers pass a guarded context
// (tenant access + permission already verified). Repos stay pure; the service
// enforces hierarchy invariants (no cycles), maintains department depth/path,
// and records an audit-log entry on every write.

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string | null,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

// --- Companies --------------------------------------------------------------

export async function listCompanies(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await orgRepo.listCompanies(tenantId))
}

export async function createCompany(
  context: CurrentUserContext,
  tenantId: string,
  input: orgRepo.CompanyWriteInput,
) {
  const company = await orgRepo.createCompany(
    tenantId,
    input,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.org_manage', 'hr_company', company.id, {
    code: company.code,
  })

  return serializeRecord(company)
}

export async function updateCompany(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<orgRepo.CompanyWriteInput>,
) {
  if (input.parentCompanyId) {
    const companies = await orgRepo.listCompanies(tenantId)
    const nodes = companies.map((row) => ({
      id: row.id,
      parentId: row.parentCompanyId,
    }))
    if (wouldCreateCycle(nodes, id, input.parentCompanyId)) {
      throw new ValidationError('A company cannot be its own ancestor.')
    }
  }

  const company = await orgRepo.updateCompany(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!company) {
    throw new NotFoundError('Company not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_company', id, null)

  return serializeRecord(company)
}

export async function deleteCompany(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await orgRepo.softDeleteCompany(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) {
    throw new NotFoundError('Company not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_company', id, null)

  return { id, deleted: true }
}

// --- Branches ---------------------------------------------------------------

export async function listBranches(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await orgRepo.listBranches(tenantId))
}

export async function createBranch(
  context: CurrentUserContext,
  tenantId: string,
  input: orgRepo.BranchWriteInput,
) {
  const branch = await orgRepo.createBranch(tenantId, input, context.profileId)
  await audit(context, tenantId, 'hr.org_manage', 'hr_branch', branch.id, {
    code: branch.code,
  })

  return serializeRecord(branch)
}

export async function updateBranch(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<orgRepo.BranchWriteInput>,
) {
  const branch = await orgRepo.updateBranch(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!branch) {
    throw new NotFoundError('Branch not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_branch', id, null)

  return serializeRecord(branch)
}

export async function deleteBranch(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await orgRepo.softDeleteBranch(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) {
    throw new NotFoundError('Branch not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_branch', id, null)

  return { id, deleted: true }
}

// --- Departments ------------------------------------------------------------

// Derives depth + a materialized path from the parent chain, rejecting cycles.
async function deriveDepartmentHierarchy(
  tenantId: string,
  id: string | null,
  parentDepartmentId: string | null | undefined,
) {
  if (parentDepartmentId === undefined) {
    return { depthLevel: undefined, pathText: undefined }
  }

  if (!parentDepartmentId) {
    return { depthLevel: 0, pathText: null }
  }

  const departments = await orgRepo.listDepartments(tenantId)
  const nodes = departments.map((row) => ({
    id: row.id,
    parentId: row.parentDepartmentId,
  }))

  if (id && wouldCreateCycle(nodes, id, parentDepartmentId)) {
    throw new ValidationError('A department cannot be its own ancestor.')
  }

  const parent = departments.find((row) => row.id === parentDepartmentId)
  if (!parent) {
    throw new ValidationError('Parent department not found.')
  }

  // Depth of the parent + 1 (compute on the parent's own chain).
  const parentDepth = computeDepth(nodes, parentDepartmentId)
  const depthLevel = (parentDepth < 0 ? 0 : parentDepth) + 1
  const pathText = `${parent.pathText ?? parent.code}/${parent.code}`

  return { depthLevel, pathText }
}

export async function listDepartments(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await orgRepo.listDepartments(tenantId))
}

// Returns departments as a nested tree for the org-chart view.
export async function getDepartmentTree(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const departments = await orgRepo.listDepartments(tenantId)
  return buildForest(
    departments.map((row) => ({ ...row, parentId: row.parentDepartmentId })),
  )
}

export async function createDepartment(
  context: CurrentUserContext,
  tenantId: string,
  input: orgRepo.DepartmentWriteInput,
) {
  const derived = await deriveDepartmentHierarchy(
    tenantId,
    null,
    input.parentDepartmentId ?? null,
  )
  const department = await orgRepo.createDepartment(
    tenantId,
    input,
    {
      depthLevel: derived.depthLevel ?? 0,
      pathText: derived.pathText ?? null,
    },
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.org_manage',
    'hr_department',
    department.id,
    {
      code: department.code,
    },
  )

  return serializeRecord(department)
}

export async function updateDepartment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<orgRepo.DepartmentWriteInput>,
) {
  const derived = await deriveDepartmentHierarchy(
    tenantId,
    id,
    input.parentDepartmentId,
  )
  const department = await orgRepo.updateDepartment(
    tenantId,
    id,
    input,
    derived,
    context.profileId,
  )
  if (!department) {
    throw new NotFoundError('Department not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_department', id, null)

  return serializeRecord(department)
}

export async function deleteDepartment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await orgRepo.softDeleteDepartment(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) {
    throw new NotFoundError('Department not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_department', id, null)

  return { id, deleted: true }
}

// --- Positions --------------------------------------------------------------

export async function listPositions(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await orgRepo.listPositions(tenantId))
}

export async function createPosition(
  context: CurrentUserContext,
  tenantId: string,
  input: orgRepo.PositionWriteInput,
) {
  const position = await orgRepo.createPosition(
    tenantId,
    input,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.org_manage', 'hr_position', position.id, {
    code: position.code,
  })

  return serializeRecord(position)
}

export async function updatePosition(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<orgRepo.PositionWriteInput>,
) {
  const position = await orgRepo.updatePosition(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!position) {
    throw new NotFoundError('Position not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_position', id, null)

  return serializeRecord(position)
}

export async function deletePosition(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await orgRepo.softDeletePosition(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) {
    throw new NotFoundError('Position not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_position', id, null)

  return { id, deleted: true }
}

// --- Job grades -------------------------------------------------------------

export async function listJobGrades(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await orgRepo.listJobGrades(tenantId))
}

export async function createJobGrade(
  context: CurrentUserContext,
  tenantId: string,
  input: orgRepo.JobGradeWriteInput,
) {
  const grade = await orgRepo.createJobGrade(tenantId, input, context.profileId)
  await audit(context, tenantId, 'hr.org_manage', 'hr_job_grade', grade.id, {
    code: grade.code,
  })

  return serializeRecord(grade)
}

export async function updateJobGrade(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<orgRepo.JobGradeWriteInput>,
) {
  const grade = await orgRepo.updateJobGrade(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!grade) {
    throw new NotFoundError('Job grade not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_job_grade', id, null)

  return serializeRecord(grade)
}

export async function deleteJobGrade(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await orgRepo.softDeleteJobGrade(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) {
    throw new NotFoundError('Job grade not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_job_grade', id, null)

  return { id, deleted: true }
}

// --- Cost centers -----------------------------------------------------------

export async function listCostCenters(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await orgRepo.listCostCenters(tenantId))
}

export async function createCostCenter(
  context: CurrentUserContext,
  tenantId: string,
  input: orgRepo.CostCenterWriteInput,
) {
  const center = await orgRepo.createCostCenter(
    tenantId,
    input,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.org_manage', 'hr_cost_center', center.id, {
    code: center.code,
  })

  return serializeRecord(center)
}

export async function updateCostCenter(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<orgRepo.CostCenterWriteInput>,
) {
  if (input.parentId) {
    const centers = await orgRepo.listCostCenters(tenantId)
    const nodes = centers.map((row) => ({ id: row.id, parentId: row.parentId }))
    if (wouldCreateCycle(nodes, id, input.parentId)) {
      throw new ValidationError('A cost center cannot be its own ancestor.')
    }
  }

  const center = await orgRepo.updateCostCenter(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!center) {
    throw new NotFoundError('Cost center not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_cost_center', id, null)

  return serializeRecord(center)
}

export async function deleteCostCenter(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await orgRepo.softDeleteCostCenter(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) {
    throw new NotFoundError('Cost center not found.')
  }

  await audit(context, tenantId, 'hr.org_manage', 'hr_cost_center', id, null)

  return { id, deleted: true }
}
