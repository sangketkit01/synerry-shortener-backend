import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Starting database seeding...");

  // 1. Hash passwords
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 10);
  const demoPasswordHash = await bcrypt.hash("Demo@123456", 10);

  // 2. Create or update Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@synerry.com" },
    update: {
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
    create: {
      email: "admin@synerry.com",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`[Seed] Admin user ready: ${admin.email}`);

  // 3. Create or update Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@synerry.com" },
    update: {
      passwordHash: demoPasswordHash,
      role: Role.USER,
    },
    create: {
      email: "demo@synerry.com",
      passwordHash: demoPasswordHash,
      role: Role.USER,
    },
  });
  console.log(`[Seed] Demo user ready: ${demoUser.email}`);

  // 4. Create sample Group for demo user
  const group = await prisma.group.upsert({
    where: {
      userId_name: {
        userId: demoUser.id,
        name: "General Links",
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      name: "General Links",
      color: "#2563EB",
    },
  });
  console.log(`[Seed] Sample group ready: ${group.name}`);

  // 5. Create sample Short URL (as featured in the Synerry exam prompt)
  const sampleUrl = await prisma.url.upsert({
    where: { shortCode: "rAJMO" },
    update: {},
    create: {
      userId: demoUser.id,
      groupId: group.id,
      originalUrl: "https://www.synerry.com",
      shortCode: "rAJMO",
      title: "Synerry Official Website",
      isFavorite: true,
      isActive: true,
      clickCount: 0,
    },
  });
  console.log(`[Seed] Sample Short URL ready: ${sampleUrl.shortCode} -> ${sampleUrl.originalUrl}`);

  console.log("[Seed] Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("[Seed Error]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
