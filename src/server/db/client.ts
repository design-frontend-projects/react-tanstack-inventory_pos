import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#/server/db/generated/prisma/client'
import { Pool } from 'pg'

import { serverEnv } from '#/lib/env/server'

type DbClient = ReturnType<typeof createPrismaClient>

declare global {
  var __prismaClient__: DbClient | undefined
}

function createPrismaClient() {
  const pool = new Pool({
    connectionString: serverEnv.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  })

  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
  })
}

export const prisma: DbClient =
  globalThis.__prismaClient__ ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaClient__ = prisma
}
