import "server-only";
import { prisma } from "@/lib/db";
import { STALE_AFTER_MS } from "@/lib/generation/constants";

/**
 * "Osilib qolgan" generatsiyalarni FAILED qilish.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Fon ishi tugamay qolishi mumkin: server qayta ishga tushdi, serverless
 * chaqiruvi `maxDuration` da uzildi, yoki jarayon o'ldirildi. Bunday
 * holatda yozuv MANGU `PENDING` holatida qoladi va foydalanuvchi
 * sahifani cheksiz yangilab o'tiraveradi.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * Ro'yxat yoki bitta yozuv o'qilganda, belgilangan vaqtdan uzoq PENDING
 * turgan yozuvlar FAILED qilinadi. Alohida cron yoki fon xizmati kerak
 * emas — tekshiruv o'qish yo'lida, arzon `updateMany` bilan bajariladi.
 *
 * Bu "o'z-o'zini tozalash" MVP uchun yetarli: foydalanuvchi natijani
 * ko'rmoqchi bo'lganda holat allaqachon to'g'rilangan bo'ladi.
 */

/** Qulaylik uchun qayta eksport. */
export { STALE_AFTER_MS };

export type GenerationModel = "lessonPlan" | "presentation" | "calendarPlan";

/**
 * Foydalanuvchining osilib qolgan yozuvlarini FAILED qiladi.
 *
 * Faqat SHU foydalanuvchi yozuvlariga tegadi — boshqalarnikiga emas.
 *
 * `switch` ataylab: Prisma delegate'ini dinamik olish (`prisma[model]`)
 * tip xavfsizligini yo'qotadi va ustun nomi o'zgarsa kompilyator xato
 * bermay qo'yadi.
 */
export async function markStaleAsFailed(
  model: GenerationModel,
  userId: string,
): Promise<number> {
  const where = {
    userId,
    status: "PENDING" as const,
    // `updatedAt` — yozuv oxirgi marta tegilgan payt. Qayta generatsiya
    // qilinganda ham yangilanadi, shuning uchun `createdAt` dan to'g'riroq.
    updatedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
  };
  const data = {
    status: "FAILED" as const,
    errorMessage: "errors.domain.generationTimedOut",
  };

  const { count } = await (model === "lessonPlan"
    ? prisma.lessonPlan.updateMany({ where, data })
    : model === "presentation"
      ? prisma.presentation.updateMany({ where, data })
      : prisma.calendarPlan.updateMany({ where, data }));

  if (count > 0) {
    console.warn(`[fon] ${model}: ${count} ta osilib qolgan yozuv FAILED qilindi`);
  }
  return count;
}
