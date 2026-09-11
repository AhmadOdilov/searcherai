import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getEnv } from "@/lib/env";

/**
 * Prisma klient singleton'i.
 *
 * Nega singleton: `next dev` har o'zgarishda modullarni qayta yuklaydi.
 * Har yuklashda yangi klient yaratilsa, ulanishlar to'planib ketadi va
 * Postgres "too many clients" xatosini beradi. Shuning uchun klient
 * `globalThis` da saqlanadi — HMR uni o'chirmaydi.
 *
 * Prisma 7'da ulanish manzili sxemada emas: `PrismaPg` driver adapter
 * orqali beriladi (`prisma7.config.ts` esa faqat migratsiya uchun).
 */

function createPrismaClient(): PrismaClient {
  const env = getEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    // Ishlab chiqishda sekin so'rovlarni ko'rish uchun — Step 5 (performance)
    // da shu loglar N+1 muammolarini topishga yordam beradi.
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
