import { prisma } from './src/server/db/client'
const wfs = await prisma.podApprovalWorkflow.findMany({
  where: { code: 'PO-DEFAULT' },
  include: { steps: true },
})
console.log('PO-DEFAULT workflows:', wfs.length)
for (const wf of wfs) {
  console.log(`  tenant=${wf.tenantId} entity=${wf.entityType} active=${wf.isActive} steps=${wf.steps.length} min=${wf.minAmount ?? 'null'}`)
  for (const s of wf.steps) {
    console.log(`    step ${s.stepOrder}: role=${s.approverRoleCode ?? '-'} min=${s.minAmount ?? 'null'} final=${s.isFinal}`)
  }
}
await prisma.$disconnect()
