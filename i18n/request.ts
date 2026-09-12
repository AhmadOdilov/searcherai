import { getRequestConfig } from "next-intl/server";
import { getRequestLocale } from "@/lib/i18n/locale";

/**
 * next-intl so'rov sozlamasi.
 *
 * ── Nega URL'da til prefiksi YO'Q ─────────────────────────────────────────
 * next-intl'ning odatiy sozlamasi `/[locale]/...` segmentidan foydalanadi.
 * Bizda til manbai boshqa: kirgan foydalanuvchining `User.language` ustuni.
 * URL'ga til qo'shilsa, bir xil sahifaning ikki manzili paydo bo'lardi va
 * mavjud `proxy.ts` hamda barcha havolalarni qayta yozishga to'g'ri kelardi.
 *
 * Shuning uchun til HAR SO'ROVDA `getRequestLocale()` orqali aniqlanadi.
 */
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
    // Sana va son formatlash uchun — foydalanuvchining vaqt mintaqasi
    // hozircha kuzatilmaydi, Toshkent standart sifatida olinadi.
    timeZone: "Asia/Tashkent",
  };
});
