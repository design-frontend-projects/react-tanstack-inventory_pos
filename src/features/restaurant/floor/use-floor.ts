'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  createDiningAreaServerFn,
  createTableSectionServerFn,
  createTableServerFn,
  listDiningAreasServerFn,
  listTableSectionsServerFn,
  listTablesServerFn,
} from '#/features/restaurant/master-data/server-functions'
import {
  deleteDiningAreaServerFn,
  deleteTableSectionServerFn,
  deleteTableServerFn,
  getFloorStatusServerFn,
  listFloorAssignmentsServerFn,
  removeFloorAssignmentServerFn,
  setTableStatusServerFn,
  updateDiningAreaServerFn,
  updateTableSectionServerFn,
  updateTableServerFn,
  upsertFloorAssignmentServerFn,
} from '#/features/restaurant/floor/server-functions'
import { listTenantUsersServerFn } from '#/features/auth/server-functions'
import type { z } from 'zod'
import type {
  DiningAreaUpdateInput,
  FloorAssignmentUpsertInput,
  TableSectionUpdateInput,
  TableStatusSetValue,
  TableUpdateInput,
} from '#/features/restaurant/floor/validation'
import type {
  diningAreaCreateSchema,
  tableCreateSchema,
  tableSectionCreateSchema,
} from '#/features/restaurant/master-data/validation'

export type DiningAreaCreateInput = z.infer<typeof diningAreaCreateSchema>
export type TableSectionCreateInput = z.infer<typeof tableSectionCreateSchema>
export type TableCreateInput = z.infer<typeof tableCreateSchema>

// --- Live floor status (realtime-invalidated) --------------------------------

export function useFloorStatus(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-floor-status', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getFloorStatusServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}

// --- Setup reads -------------------------------------------------------------

export function useDiningAreas(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-dining-areas', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listDiningAreasServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}

export function useTableSections(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-table-sections', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listTableSectionsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}

export function useTables(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-tables', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listTablesServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}

export function useFloorAssignments(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-floor-assignments', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listFloorAssignmentsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}

// Member directory for the assignment pickers. Requires `user.view`; pass
// `enabled: false` for viewers without it so the query never fires.
export function useTenantMembers(enabled: boolean) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-floor-members', tenantId],
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listTenantUsersServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          filters: { status: 'active' },
        },
      })
    },
  })
}

// --- Mutations ---------------------------------------------------------------

export function useFloorMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    for (const prefix of [
      'res-dining-areas',
      'res-table-sections',
      'res-tables',
      'res-floor-status',
      'res-floor-assignments',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
    }
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing the floor.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createDiningArea = useMutation({
    mutationFn: async (input: DiningAreaCreateInput) =>
      createDiningAreaServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateDiningArea = useMutation({
    mutationFn: async (args: { id: string; input: DiningAreaUpdateInput }) =>
      updateDiningAreaServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteDiningArea = useMutation({
    mutationFn: async (id: string) =>
      deleteDiningAreaServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const createSection = useMutation({
    mutationFn: async (input: TableSectionCreateInput) =>
      createTableSectionServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateSection = useMutation({
    mutationFn: async (args: { id: string; input: TableSectionUpdateInput }) =>
      updateTableSectionServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteSection = useMutation({
    mutationFn: async (id: string) =>
      deleteTableSectionServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const createTable = useMutation({
    mutationFn: async (input: TableCreateInput) =>
      createTableServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateTable = useMutation({
    mutationFn: async (args: { id: string; input: TableUpdateInput }) =>
      updateTableServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteTable = useMutation({
    mutationFn: async (id: string) =>
      deleteTableServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const setTableStatus = useMutation({
    mutationFn: async (args: { tableId: string; status: TableStatusSetValue }) =>
      setTableStatusServerFn({
        data: { ...(await payload()), tableId: args.tableId, status: args.status },
      }),
    onSuccess: invalidate,
  })

  const upsertAssignment = useMutation({
    mutationFn: async (input: FloorAssignmentUpsertInput) =>
      upsertFloorAssignmentServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const removeAssignment = useMutation({
    mutationFn: async (id: string) =>
      removeFloorAssignmentServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return {
    createDiningArea,
    updateDiningArea,
    deleteDiningArea,
    createSection,
    updateSection,
    deleteSection,
    createTable,
    updateTable,
    deleteTable,
    setTableStatus,
    upsertAssignment,
    removeAssignment,
  }
}
