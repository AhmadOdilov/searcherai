/**
 * Fon generatsiyasining vaqt chegaralari.
 *
 * ── Nega alohida fayl ─────────────────────────────────────────────────────
 * Bu qiymatlar ikki tomonda ham kerak: serverda (`stale.ts`) va klientda
 * (polling hook). Agar ular `stale.ts` ichida qolsa, ularni import qilgan
 * har bir joy Prisma klientini ham tortib kelardi — birlik sinovlarida bu
 * baza sozlamasini talab qilardi.
 *
 * Shuning uchun konstantalar hech narsaga bog'lanmagan faylda.
 */

/**
 * Shundan uzoq PENDING turgan yozuv "osilib qolgan" hisoblanadi.
 *
 * Eng uzun generatsiya (kalendar reja, qayta urinish bilan) ~2 daqiqa.
 * 5 daqiqa — yetarlicha keng zaxira: hali ishlayotgan generatsiyani
 * xato bilan to'xtatib qo'ymaslik uchun.
 */
export const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Polling hook'ning umumiy chegarasi.
 *
 * `STALE_AFTER_MS` dan UZUN bo'lishi SHART: server yozuvni FAILED qilishga
 * ulgursin, shunda foydalanuvchi sababni ko'radi. Aks holda hook oldinroq
 * to'xtab, "nima bo'ldi?" degan savol javobsiz qolardi.
 */
export const POLL_TIMEOUT_MS = 6 * 60 * 1000;

/** Polling so'rovlari orasidagi oraliq. */
export const POLL_INTERVAL_MS = 2000;

/** Ketma-ket nechta xatodan keyin polling to'xtaydi. */
export const POLL_MAX_ERRORS = 3;
