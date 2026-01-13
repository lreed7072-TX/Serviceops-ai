import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function getIds() {
  const org = await prisma.org.findFirst({ select: { id: true, name: true } });
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
  });

  console.log("\n📋 Your IDs:");
  console.log(`Org ID: ${org?.id}`);
  console.log(`Org Name: ${org?.name}`);
  console.log(`User ID: ${user?.id}`);
  console.log(`User Email: ${user?.email}`);
  console.log("\n🌱 Run seed script:");
  console.log(`npx tsx scripts/seed-procedures.ts ${org?.id} ${user?.id}\n`);

  await prisma.$disconnect();
}

getIds();
