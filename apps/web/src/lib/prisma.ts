import { PrismaClient } from "@prisma/client";

// Prevent multiple Prisma Client instances in Next.js dev mode (hot-reload creates new
// module instances, which would exhaust the Neon connection pool without this singleton).
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
