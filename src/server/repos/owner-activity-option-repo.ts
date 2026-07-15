import { prisma } from '#/server/db/client'

export async function listActiveActivityOptions() {
  return prisma.ownerActivityOption.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  })
}

export async function findActiveActivityOptionByCode(code: string) {
  return prisma.ownerActivityOption.findFirst({
    where: {
      code,
      isActive: true,
      deletedAt: null,
    },
  })
}
