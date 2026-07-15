import type { Prisma } from '#/server/db/generated/prisma/client'
import type { prisma } from '#/server/db/client'

// A Prisma client that may be either the shared singleton or an in-flight
// transaction client. Repos accept this as an optional trailing argument so a
// caller can enlist the operation in a `$transaction`; it defaults to the
// singleton for standalone use.
export type PrismaClientLike = Prisma.TransactionClient | typeof prisma
