import type { ActivityOption } from '#/types/owner'
import { listActiveActivityOptions } from '#/server/repos/owner-activity-option-repo'

export async function listPublicActivityOptions(): Promise<Array<ActivityOption>> {
  const options = await listActiveActivityOptions()

  return options.map((option) => ({
    code: option.code,
    name: option.name,
    nameAr: option.nameAr,
  }))
}
