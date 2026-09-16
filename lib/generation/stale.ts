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

/** Osilib qolgan yozuv qanday belgilanadi — ikkala yo'l uchun umumiy. */
const STALE_DATA = {
  status: "FAILED" as const,
  errorMessage: "errors.domain.generationTimedOut",
};

/** Shu vaqtdan oldin tegilgan PENDING yozuv "osilib qolgan" hisoblanadi. */
function staleBefore(): Date {
  return new Date(Date.now() - STALE_AFTER_MS);
}

/**
 * BARCHA foydalanuvchilarning osilib qolgan generatsiyalarini FAILED qiladi.
 *
 * ── Nega `markStaleAsFailed()` yetarli emas edi ───────────────────────────
 * U `userId` talab qiladi va faqat o'qish yo'lida chaqiriladi. Ya'ni
 * yozuvni FAILED qilish uchun AYNAN o'sha o'qituvchining o'zi sahifaga
 * qaytishi kerak edi.
 *
 * Amaliy holat: o'qituvchi kalendar reja so'radi va telefonni yopdi. Shu
 * payt deploy bo'ldi — `after()` ichidagi fon ishi uzildi. Yozuv PENDING
 * bo'lib qoldi. O'qituvchi qaytmasa, u MANGU shu holatda turadi va
 * ro'yxatda "Tayyorlanmoqda" deb ko'rinaveradi.
 *
 * ── Nega navbat (queue) QO'SHILMADI ───────────────────────────────────────
 * Muammo navbat yo'qligida emas — tozalashning qamrovida edi. Redis yoki
 * BullMQ yangi xizmat, yangi deploy va yangi nosozlik nuqtasi qo'shardi,
 * holbuki yechim bitta `updateMany` so'roviga sig'adi.
 *
 * ── Qachon chaqiriladi ────────────────────────────────────────────────────
 * `instrumentation.ts` dagi `register()` — Next.js serveri ishga
 * tushganda BIR MARTA. Bu aynan xavf paydo bo'ladigan nuqta: deploy yoki
 * qayta ishga tushish oldingi jarayonning fon ishlarini uzib ketadi, yangi
 * jarayon esa darhol ularni tozalaydi.
 *
 * ── Chegara (halol aytilishi kerak) ───────────────────────────────────────
 * Loyihada rejalashtiruvchi (cron/scheduler) YO'Q va bu yerda soxtasi
 * yaratilmadi. Demak qamrov quyidagicha:
 *   · deploy / qayta ishga tushish  → shu funksiya darhol tozalaydi;
 *   · AI osilib qolishi             → foydalanuvchi qaytganda
 *     `markStaleAsFailed()` tozalaydi.
 * Ikkala yo'l birga barcha ma'lum holatlarni qoplaydi. Server oylab qayta
 * ishga tushmasa va foydalanuvchi ham qaytmasa — yozuv PENDING qoladi;
 * bunday holat uchun kelajakda `docker compose exec` yoki cron orqali
 * chaqiriladigan buyruq qo'shish yetarli.
 */
export async function recoverStaleGenerations(): Promise<{
  lessonPlan: number;
  presentation: number;
  calendarPlan: number;
  total: number;
}> {
  const where = {
    status: "PENDING" as const,
    updatedAt: { lt: staleBefore() },
  };

  /*
    Uchala model ketma-ket — parallel emas.

    Sabab: bu funksiya server ishga tushayotganda chaqiriladi va
    `register()` tugamaguncha server so'rovlarni qabul qilmaydi. Uchta
    parallel yozuv bazaga bir vaqtda tushgandan ko'ra, ketma-ket va
    bashorat qilinadigan bo'lgani ma'qul.
  */
  const lessonPlan = (await prisma.lessonPlan.updateMany({ where, data: STALE_DATA }))
    .count;
  const presentation = (await prisma.presentation.updateMany({ where, data: STALE_DATA }))
    .count;
  const calendarPlan = (await prisma.calendarPlan.updateMany({ where, data: STALE_DATA }))
    .count;

  const total = lessonPlan + presentation + calendarPlan;

  if (total > 0) {
    console.warn(
      `[fon] ishga tushishda ${total} ta osilib qolgan generatsiya FAILED qilindi ` +
        `(dars: ${lessonPlan}, prezentatsiya: ${presentation}, reja: ${calendarPlan})`,
    );
  }

  return { lessonPlan, presentation, calendarPlan, total };
}

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
    updatedAt: { lt: staleBefore() },
  };
  const data = STALE_DATA;

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
