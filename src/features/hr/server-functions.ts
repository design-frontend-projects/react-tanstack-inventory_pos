import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as employeeService from '#/server/hr/employee-service'
import * as orgService from '#/server/hr/organization-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  branchWriteSchema,
  companyWriteSchema,
  costCenterWriteSchema,
  departmentWriteSchema,
  employeeCreateSchema,
  employeeFiltersSchema,
  employeeUpdateSchema,
  jobGradeWriteSchema,
  positionWriteSchema,
} from '#/features/hr/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

const base = z.object({
  accessToken: accessTokenSchema,
  tenantId: tenantIdSchema,
})
const withId = base.extend({ id: idSchema })

// --- Companies --------------------------------------------------------------

export const listCompaniesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.listCompanies(context, data.tenantId)
  })

export const createCompanyServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: companyWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.createCompany(context, data.tenantId, data.input)
  })

export const updateCompanyServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: companyWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.updateCompany(context, data.tenantId, data.id, data.input)
  })

export const deleteCompanyServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.deleteCompany(context, data.tenantId, data.id)
  })

// --- Branches ---------------------------------------------------------------

export const listBranchesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.listBranches(context, data.tenantId)
  })

export const createBranchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: branchWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.createBranch(context, data.tenantId, data.input)
  })

export const updateBranchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: branchWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.updateBranch(context, data.tenantId, data.id, data.input)
  })

export const deleteBranchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.deleteBranch(context, data.tenantId, data.id)
  })

// --- Departments ------------------------------------------------------------

export const listDepartmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.listDepartments(context, data.tenantId)
  })

export const departmentTreeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.getDepartmentTree(context, data.tenantId)
  })

export const createDepartmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: departmentWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.createDepartment(context, data.tenantId, data.input)
  })

export const updateDepartmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: departmentWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.updateDepartment(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteDepartmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.deleteDepartment(context, data.tenantId, data.id)
  })

// --- Positions --------------------------------------------------------------

export const listPositionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.listPositions(context, data.tenantId)
  })

export const createPositionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: positionWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.createPosition(context, data.tenantId, data.input)
  })

export const updatePositionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: positionWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.updatePosition(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deletePositionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.deletePosition(context, data.tenantId, data.id)
  })

// --- Job grades -------------------------------------------------------------

export const listJobGradesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.listJobGrades(context, data.tenantId)
  })

export const createJobGradeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: jobGradeWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.createJobGrade(context, data.tenantId, data.input)
  })

export const updateJobGradeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: jobGradeWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.updateJobGrade(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteJobGradeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.deleteJobGrade(context, data.tenantId, data.id)
  })

// --- Cost centers -----------------------------------------------------------

export const listCostCentersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_view')
    return orgService.listCostCenters(context, data.tenantId)
  })

export const createCostCenterServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: costCenterWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.createCostCenter(context, data.tenantId, data.input)
  })

export const updateCostCenterServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: costCenterWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.updateCostCenter(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteCostCenterServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.org_manage')
    return orgService.deleteCostCenter(context, data.tenantId, data.id)
  })

// --- Employees --------------------------------------------------------------

export const listEmployeesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: employeeFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return employeeService.listEmployees(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const getEmployeeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return employeeService.getEmployee(context, data.tenantId, data.id)
  })

export const createEmployeeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: employeeCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return employeeService.createEmployee(context, data.tenantId, data.input)
  })

export const updateEmployeeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: employeeUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return employeeService.updateEmployee(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteEmployeeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ reason: z.string().max(400).optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return employeeService.deleteEmployee(
      context,
      data.tenantId,
      data.id,
      data.reason,
    )
  })

export const employeeHistoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return employeeService.getEmployeeHistory(context, data.tenantId, data.id)
  })
