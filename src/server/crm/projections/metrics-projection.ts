import { CHURN_MODEL_NAME, computeChurnScore } from '#/server/crm/churn-heuristics'
import {
  averageOrderValue,
  emptyMetricsFacts,
  estimateClv,
  foldEvent,
  topKey,
} from '#/server/crm/metrics-fold'
import type { FavoriteCounters, MetricsFacts } from '#/server/crm/metrics-fold'
import { scoreRfm } from '#/server/crm/rfm-scoring'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { CrmCustomerMetrics, DomainEvent } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'
import * as metricsRepo from '#/server/repos/crm-metrics-repo'
import * as scoreRepo from '#/server/repos/crm-score-repo'

// Folds domain events into crm_customer_metrics (+ monthly trend rows).
// Idempotency: the row's monotonic lastEventSequence — replayed events
// (id <= lastEventSequence) are skipped, so at-least-once delivery cannot
// double-count.

function factsFromRow(row: CrmCustomerMetrics | null): MetricsFacts {
  if (!row) {
    return emptyMetricsFacts()
  }

  const favorites = (row.favoritesJson ?? {}) as unknown as Partial<FavoriteCounters>

  return {
    firstPurchaseAt: row.firstPurchaseAt,
    lastPurchaseAt: row.lastPurchaseAt,
    ordersCount: row.ordersCount,
    totalSpend: new Prisma.Decimal(row.totalSpend),
    returnsCount: row.returnsCount,
    returnsValue: new Prisma.Decimal(row.returnsValue),
    visitCount: row.visitCount,
    favorites: {
      products: favorites.products ?? {},
      warehouses: favorites.warehouses ?? {},
      paymentMethods: favorites.paymentMethods ?? {},
    },
  }
}

function periodKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

interface LoyaltyEarnPayload {
  points?: number
}

export async function projectMetrics(tx: PrismaClientLike, event: DomainEvent) {
  if (!event.customerId) {
    return
  }

  // Monthly points trend rides on loyalty events; the main fold ignores them.
  if (event.eventType === 'crm.loyalty_earned') {
    const payload = event.payloadJson as LoyaltyEarnPayload

    if (payload.points && payload.points > 0) {
      await metricsRepo.incrementMonthly(
        event.tenantId,
        event.customerId,
        periodKeyOf(event.occurredAt),
        { pointsEarned: payload.points },
        tx
      )
    }

    return
  }

  const row = await metricsRepo.findMetrics(event.tenantId, event.customerId, tx)

  if (row && row.lastEventSequence >= event.id) {
    return
  }

  const facts = foldEvent(factsFromRow(row), {
    eventType: event.eventType,
    payloadJson: event.payloadJson,
    occurredAt: event.occurredAt,
  })

  if (!facts) {
    // Not a metrics-affecting event; still advance the guard when a row
    // exists so replay detection stays tight.
    return
  }

  const now = new Date()
  const rfm = scoreRfm({
    lastPurchaseAt: facts.lastPurchaseAt,
    ordersCount: facts.ordersCount,
    totalSpend: facts.totalSpend.toNumber(),
    now,
  })
  const churn = computeChurnScore({
    firstPurchaseAt: facts.firstPurchaseAt,
    lastPurchaseAt: facts.lastPurchaseAt,
    ordersCount: facts.ordersCount,
    now,
  })

  await metricsRepo.upsertMetrics(
    event.tenantId,
    event.customerId,
    {
      firstPurchaseAt: facts.firstPurchaseAt,
      lastPurchaseAt: facts.lastPurchaseAt,
      ordersCount: facts.ordersCount,
      totalSpend: facts.totalSpend,
      avgOrderValue: averageOrderValue(facts),
      returnsCount: facts.returnsCount,
      returnsValue: facts.returnsValue,
      visitCount: facts.visitCount,
      favoriteProductId: topKey(facts.favorites.products),
      favoriteWarehouseId: topKey(facts.favorites.warehouses),
      favoritePaymentMethod: topKey(facts.favorites.paymentMethods),
      favoritesJson: facts.favorites as unknown as Prisma.InputJsonValue,
      rfmRecency: rfm?.recency ?? null,
      rfmFrequency: rfm?.frequency ?? null,
      rfmMonetary: rfm?.monetary ?? null,
      rfmSegment: rfm?.segment ?? null,
      churnScore: churn,
      clvEstimate: estimateClv(facts, now),
      lastEventSequence: event.id,
    },
    tx
  )

  // AI-ready contract: mirror the churn heuristic into the model-agnostic
  // score store (scoreType='churn', modelName='heuristic-v1'). Future ML
  // pipelines overwrite this row without a schema change.
  if (churn !== null) {
    await scoreRepo.upsertScore(
      event.tenantId,
      event.customerId,
      {
        scoreType: 'churn',
        score: churn,
        modelName: CHURN_MODEL_NAME,
        modelVersion: '1',
        featuresJson: {
          ordersCount: facts.ordersCount,
          totalSpend: facts.totalSpend.toString(),
          lastPurchaseAt: facts.lastPurchaseAt?.toISOString() ?? null,
        },
        computedAt: now,
      },
      tx
    )
  }

  if (
    event.eventType === 'pos_sale.completed' ||
    event.eventType === 'sales_order.fulfilled'
  ) {
    const payload = event.payloadJson as { grandTotal?: string }

    await metricsRepo.incrementMonthly(
      event.tenantId,
      event.customerId,
      periodKeyOf(event.occurredAt),
      { ordersCount: 1, spend: payload.grandTotal ?? '0' },
      tx
    )
  }
}
