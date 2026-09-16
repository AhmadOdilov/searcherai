import "server-only";
import { prisma } from "@/lib/db";
import type { GenerationModel } from "@/lib/generation/stale";

/**
 * Generatsiyaning HAQIQIY bosqichlari.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Ilgari UI bosqich matnini SEKUNDOMERDAN hisoblardi: o'tgan vaqtni
 * odatdagi davomiylikka bo'lib, "hozir shu bosqichda bo'lsa kerak"
 * degan taxminni ko'rsatardi. Bu yolg'on: AI sekinlashsa matn oldinga
 * ketaverardi, tez tugasa — orqada qolardi.
 *
 * Endi bosqich BAZADA saqlanadi va uni fon ishlovchisining o'zi
 * yangilaydi. Polling allaqachon yozuvni so'rab turadi, ya'ni yangi
 * transport (WebSocket/SSE) kerak emas.
 *
 * ── Nega `VALIDATING` bosqichi YO'Q ───────────────────────────────────────
 * Javobni zod bilan tekshirish `generateJson` ICHIDA, AI chaqiruvining
 * bir qismi sifatida bajariladi va odatda 50 ms dan kam vaqt oladi.
 * Uni alohida bosqich qilish uchun AI qatlamiga qayta chaqiruv
 * (callback) qo'shish kerak bo'lardi, natijada esa foydalanuvchi ko'ra
 * olmaydigan bosqich paydo bo'lardi.
 *
 * Bu yerda faqat HAQIQATAN sezilarli davom etadigan bosqichlar bor.
 * Mavjud bo'lmagan bosqichni ko'rsatish — o'sha soxta progressning
 * boshqa ko'rinishi bo'lardi.
 *
 * ── Nega enum emas, matn ──────────────────────────────────────────────────
 * Prisma enum'i har yangi bosqich uchun migratsiya talab qiladi.
 * Bosqichlar ro'yxati esa oqim o'zgargani sayin o'zgaradi. Notanish
 * qiymat UI'da shunchaki ko'rsatilmaydi (zaxira matn ishlaydi), ya'ni
 * eski yozuv hech qachon sahifani buzmaydi.
 */
export const GENERATION_STAGES = [
  /** Yozuv yaratildi, fon ishi hali boshlanmadi. */
  "QUEUED",
  /** AI'ga so'rov yuborildi — eng uzun bosqich. */
  "GENERATING",
  /** .pptx yoki .xlsx yasalmoqda. Dars ishlanmasida bu bosqich YO'Q. */
  "BUILDING_FILE",
  /** Fayl saqlagichga va natija bazaga yozilmoqda. */
  "SAVING",
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

/**
 * Yozuvning bosqichini yangilaydi.
 *
 * ── Nega xato YUTILADI ────────────────────────────────────────────────────
 * Bu — ko'rsatkich, natija emas. Bosqichni yozib bo'lmagani generatsiyani
 * to'xtatishi mumkin emas: o'qituvchi uchun muhimi hujjat, progress matni
 * emas. Xato loglanadi va oqim davom etadi.
 */
export async function setStage(
  model: GenerationModel,
  id: string,
  stage: GenerationStage,
): Promise<void> {
  const data = { stage };

  try {
    if (model === "lessonPlan") {
      await prisma.lessonPlan.update({ where: { id }, data });
    } else if (model === "presentation") {
      await prisma.presentation.update({ where: { id }, data });
    } else {
      await prisma.calendarPlan.update({ where: { id }, data });
    }
  } catch (error) {
    console.warn(`[fon] ${model}:${id} bosqichini yozib bo'lmadi:`, error);
  }
}
