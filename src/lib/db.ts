import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in dev (Next.js hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Create Prisma client with better serverless configuration
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Store the Prisma client globally to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Ensure graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
