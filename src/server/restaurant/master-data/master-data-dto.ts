import type {
  ResBranch,
  ResServiceChargeRule,
  ResTaxConfig,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on restaurant master-data rows for the
// server-function boundary (TanStack Start cannot serialize Prisma.Decimal).

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeBranch(branch: ResBranch) {
  return {
    ...branch,
    latitude: dec(branch.latitude),
    longitude: dec(branch.longitude),
  }
}

export function serializeTaxConfig(config: ResTaxConfig) {
  return {
    ...config,
    rate: config.rate.toString(),
  }
}

export function serializeServiceChargeRule(rule: ResServiceChargeRule) {
  return {
    ...rule,
    value: rule.value.toString(),
  }
}
