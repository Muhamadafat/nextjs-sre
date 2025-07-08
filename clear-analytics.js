import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.analytics.deleteMany({});
  console.log(`✅ Deleted ${result.count} analytics records`);
}
await prisma.$executeRaw`ALTER SEQUENCE analytics_id_seq RESTART WITH 1;`;
main()
  .catch(e => console.error('❌ Error:', e))
  .finally(() => prisma.$disconnect());