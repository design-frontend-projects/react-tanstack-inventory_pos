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
    // Close idle clients before Supabase's pooler reaps them out from under us.
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  })

  // node-postgres emits 'error' on the pool when an *idle* client's connection
  // drops (Supabase's pooler reaps idle sessions). Without a listener that
  // event crashes the whole process — seed runs and long dev sessions alike.
  // A dropped idle client is harmless; the pool replaces it on demand.
  pool.on('error', (error) => {
    console.warn('[db] idle client connection dropped:', error.message)
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
