'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteSegmentServerFn,
  listSegmentMembersServerFn,
  listSegmentsServerFn,
  rebuildSegmentServerFn,
  upsertSegmentServerFn,
} from '#/features/crm/server-functions'
import type { z } from 'zod'
import type { segmentUpsertSchema } from '#/features/crm/validation'
import {
  crmPayload,
  requireAccessToken,
  useTenantId,
} from '#/features/crm/use-crm-base'

// Dynamic segments: declarative rule CRUD, batch rebuild, member preview.

export type SegmentList = Awaited<ReturnType<typeof listSegmentsServerFn>>
export type SegmentRow = SegmentList[number]

export function useSegments() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-segments', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listSegmentsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useSegmentMembers(segmentId: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-segment-members', tenantId, segmentId],
    enabled: Boolean(tenantId && segmentId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listSegmentMembersServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          segmentId: segmentId as string,
          take: 100,
        },
      })
    },
  })
}

export function useSegmentMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = (segmentId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['crm-segments', tenantId] })
    if (segmentId) {
      queryClient.invalidateQueries({
        queryKey: ['crm-segment-members', tenantId, segmentId],
      })
    }
  }

  const upsertSegment = useMutation({
    mutationFn: async (input: z.infer<typeof segmentUpsertSchema>) =>
      upsertSegmentServerFn({
        data: { ...(await crmPayload(tenantId)), input },
      }),
    onSuccess: () => invalidate(),
  })

  const deleteSegment = useMutation({
    mutationFn: async (id: string) =>
      deleteSegmentServerFn({ data: { ...(await crmPayload(tenantId)), id } }),
    onSuccess: () => invalidate(),
  })

  const rebuildSegment = useMutation({
    mutationFn: async (id: string) =>
      rebuildSegmentServerFn({ data: { ...(await crmPayload(tenantId)), id } }),
    onSuccess: (_data, id) => invalidate(id),
  })

  return { upsertSegment, deleteSegment, rebuildSegment }
}
