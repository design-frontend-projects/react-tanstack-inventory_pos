import { prisma } from '#/server/db/client'
import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import * as growthRepo from '#/server/repos/res-growth-repo'
import type {
  ResGiftCard,
  ResGiftCardTransaction,
} from '#/server/db/generated/prisma/client'
import type { CurrentUserContext } from '#/types/auth'

// Gift card lifecycle: issue → reload → redeem (as an order payment) with a
// full transaction ledger. Balances never go negative.

function serializeCard(
  row: ResGiftCard & { transactions?: Array<ResGiftCardTransaction> },
) {
  return {
    ...row,
    balance: row.balance.toString(),
    issuedAmount: row.issuedAmount.toString(),
    transactions: row.transactions?.map((txn) => ({
      id: txn.id,
      kind: txn.kind,
      amount: txn.amount.toString(),
      balanceAfter: txn.balanceAfter.toString(),
      orderId: txn.orderId,
      reference: txn.reference,
      createdAt: txn.createdAt.toISOString(),
    })),
  }
}

export async function listGiftCards(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const rows = await growthRepo.listGiftCards(tenantId)
  return rows.map((row) => serializeCard(row))
}

export async function getGiftCard(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const card = await growthRepo.findGiftCardById(tenantId, id)
  if (!card) {
    throw new NotFoundError('Gift card not found')
  }
  return serializeCard(card)
}

export async function issueGiftCard(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    code: string
    customerId?: string | null
    initialBalance: string
    expiresAt?: string | null
  },
) {
  if (Number(input.initialBalance) <= 0) {
    throw new ValidationError('Initial balance must be positive')
  }
  const existing = await growthRepo.findGiftCardByCode(tenantId, input.code)
  if (existing) {
    throw new ValidationError('A card with this code already exists')
  }

  const card = await prisma.$transaction(async (tx) => {
    const created = await growthRepo.createGiftCard(
      tenantId,
      {
        code: input.code,
        customerId: input.customerId ?? null,
        initialBalance: input.initialBalance,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      tx,
    )
    await growthRepo.recordGiftCardTxn(
      tenantId,
      {
        giftCardId: created.id,
        kind: 'ISSUE',
        amount: input.initialBalance,
        balanceAfter: input.initialBalance,
      },
      tx,
    )
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_gift_card.issued',
      aggregateType: 'restaurant_gift_card',
      aggregateId: created.id,
      customerId: created.customerId,
      actorProfileId: context.profileId,
      payload: {
        cardId: created.id,
        code: created.code,
        initialBalance: input.initialBalance,
        customerId: created.customerId,
      },
    })
    return created
  })

  return serializeCard(card)
}

export async function reloadGiftCard(
  context: CurrentUserContext,
  tenantId: string,
  input: { id: string; amount: string },
) {
  if (Number(input.amount) <= 0) {
    throw new ValidationError('Reload amount must be positive')
  }
  const card = await growthRepo.findGiftCardById(tenantId, input.id)
  if (!card) {
    throw new NotFoundError('Gift card not found')
  }
  if (card.status === 'FROZEN' || card.status === 'EXPIRED') {
    throw new ValidationError('This card cannot be reloaded')
  }

  await prisma.$transaction(async (tx) => {
    const result = await growthRepo.adjustGiftCardBalance(
      tenantId,
      input.id,
      input.amount,
      tx,
    )
    if (!result) {
      throw new ValidationError('Reload failed')
    }
    await growthRepo.recordGiftCardTxn(
      tenantId,
      {
        giftCardId: input.id,
        kind: 'RELOAD',
        amount: input.amount,
        balanceAfter: result.balanceAfter,
      },
      tx,
    )
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_gift_card.reloaded',
      aggregateType: 'restaurant_gift_card',
      aggregateId: input.id,
      customerId: card.customerId,
      actorProfileId: context.profileId,
      payload: {
        cardId: input.id,
        amount: input.amount,
        balanceAfter: result.balanceAfter,
        customerId: card.customerId,
      },
    })
  })

  return getGiftCard(context, tenantId, input.id)
}

// Redeem against an order (used standalone or referenced by a GIFT_CARD
// payment row). Fails when the balance is insufficient.
export async function redeemGiftCard(
  context: CurrentUserContext,
  tenantId: string,
  input: { code: string; amount: string; orderId?: string | null },
) {
  if (Number(input.amount) <= 0) {
    throw new ValidationError('Redeem amount must be positive')
  }
  const card = await growthRepo.findGiftCardByCode(tenantId, input.code)
  if (!card) {
    throw new NotFoundError('Gift card not found')
  }
  if (card.status !== 'ACTIVE') {
    throw new ValidationError(`Card is ${card.status.toLowerCase()}`)
  }
  if (card.expiresAt && card.expiresAt < new Date()) {
    throw new ValidationError('Card has expired')
  }

  let balanceAfter = ''
  await prisma.$transaction(async (tx) => {
    const result = await growthRepo.adjustGiftCardBalance(
      tenantId,
      card.id,
      `-${input.amount}`,
      tx,
    )
    if (!result) {
      throw new ValidationError('Insufficient card balance')
    }
    balanceAfter = result.balanceAfter
    await growthRepo.recordGiftCardTxn(
      tenantId,
      {
        giftCardId: card.id,
        kind: 'REDEEM',
        amount: input.amount,
        balanceAfter: result.balanceAfter,
        orderId: input.orderId ?? null,
      },
      tx,
    )
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_gift_card.redeemed',
      aggregateType: 'restaurant_gift_card',
      aggregateId: card.id,
      customerId: card.customerId,
      actorProfileId: context.profileId,
      payload: {
        cardId: card.id,
        amount: input.amount,
        balanceAfter: result.balanceAfter,
      },
    })
  })

  return { cardId: card.id, balanceAfter }
}
