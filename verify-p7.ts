import { prisma } from '#/server/db/client'
async function main() {
  const perms = await prisma.permission.findMany({
    where: { code: { in: ['returns.view','returns.create','returns.approve','returns.receive','returns.refund','note.manage'] } },
    select: { code: true },
  })
  const roles = await prisma.role.findMany({
    where: { code: { in: ['sales_manager','pos_cashier','purchasing_officer'] } },
    select: { code: true, _count: { select: { permissions: true } } },
  })
  console.log('returns/note perms in DB:', perms.map(p=>p.code).sort().join(', '))
  console.log('roles:', roles.map(r=>`${r.code}=${r._count.permissions}`).join(', '))
  await prisma.$disconnect()
}
main().catch(e=>{console.error(e);process.exit(1)})
