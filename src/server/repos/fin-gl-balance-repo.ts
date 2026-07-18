import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Maintained per-account / per-period / per-currency balance projection.
// Incremented atomically inside every posting transaction; repairable via the
// SQL function fin_rebuild_gl_balances(tenant_id, fiscal_year_id).

export interface GlBalanceDelta {
  accountId: string
  fiscalPeriodId: string
  currencyCode: string
  debit: Prisma.Decimal | string | number
  credit: Prisma.Decimal | string | number
  baseDebit: Prisma.Decimal | string | number
  baseCredit: Prisma.Decimal | string | number
}

// Atomic upsert-increment; must run on the posting transaction client so the
// balance row commits (or rolls back) with the journal entry.
export async function applyBalanceDelta(
  tenantId: string,
  delta: GlBalanceDelta,
  client: PrismaClientLike = prisma,
): Promise<void> {
  await client.$executeRaw(Prisma.sql`
    INSERT INTO fin_gl_balances
      (id, tenant_id, account_id, fiscal_period_id, currency_code,
       period_debit, period_credit, base_period_debit, base_period_credit,
       created_at, updated_at)
    VALUES
      (gen_random_uuid(), ${tenantId}::uuid, ${delta.accountId}::uuid,
       ${delta.fiscalPeriodId}::uuid, ${delta.currencyCode},
       ${new Prisma.Decimal(delta.debit).toString()}::numeric,
       ${new Prisma.Decimal(delta.credit).toString()}::numeric,
       ${new Prisma.Decimal(delta.baseDebit).toString()}::numeric,
       ${new Prisma.Decimal(delta.baseCredit).toString()}::numeric,
       now(), now())
    ON CONFLICT (tenant_id, account_id, fiscal_period_id, currency_code)
    DO UPDATE SET
      period_debit = fin_gl_balances.period_debit + EXCLUDED.period_debit,
      period_credit = fin_gl_balances.period_credit + EXCLUDED.period_credit,
      base_period_debit = fin_gl_balances.base_period_debit + EXCLUDED.base_period_debit,
      base_period_credit = fin_gl_balances.base_period_credit + EXCLUDED.base_period_credit,
      updated_at = now()
  `)
}

export function listBalancesForPeriod(
  tenantId: string,
  fiscalPeriodId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finGlBalance.findMany({
    where: { tenantId, fiscalPeriodId },
    include: { account: { include: { accountType: true } } },
    orderBy: { account: { code: 'asc' } },
  })
}

export interface TrialBalanceRow {
  accountId: string
  accountCode: string
  accountName: string
  totalBaseDebit: Prisma.Decimal
  totalBaseCredit: Prisma.Decimal
}

// Trial balance over a period range (base currency), O(accounts).
export function readTrialBalance(
  tenantId: string,
  fiscalPeriodIds: Array<string>,
  client: PrismaClientLike = prisma,
): Promise<Array<TrialBalanceRow>> {
  if (fiscalPeriodIds.length === 0) {
    return Promise.resolve([])
  }

  return client.$queryRaw<Array<TrialBalanceRow>>(Prisma.sql`
    SELECT
      a.id AS "accountId",
      a.code AS "accountCode",
      a.name AS "accountName",
      COALESCE(SUM(b.base_opening_debit + b.base_period_debit), 0) AS "totalBaseDebit",
      COALESCE(SUM(b.base_opening_credit + b.base_period_credit), 0) AS "totalBaseCredit"
    FROM fin_gl_balances b
    JOIN fin_accounts a ON a.id = b.account_id
    WHERE b.tenant_id = ${tenantId}::uuid
      AND b.fiscal_period_id IN (${Prisma.join(
        fiscalPeriodIds.map((id) => Prisma.sql`${id}::uuid`),
      )})
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `)
}

export async function rebuildGlBalances(
  tenantId: string,
  fiscalYearId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  await client.$executeRaw(Prisma.sql`
    SELECT fin_rebuild_gl_balances(${tenantId}::uuid, ${fiscalYearId}::uuid)
  `)
}
