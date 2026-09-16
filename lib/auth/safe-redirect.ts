/**
 * Kirishdan keyingi qaytish manzilini XAVFSIZ ichki yo'lga aylantirish.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * `proxy.ts` himoyalangan sahifani so'ragan mehmonni `/login?next=...` ga
 * yuboradi, kirish sahifasi esa muvaffaqiyatdan keyin o'sha manzilga
 * o'tadi. `next` — SO'ROV qismi, ya'ni uni istalgan odam yozadi.
 *
 * Ilgari tekshiruv SATR shakliga qaralardi:
 *
 *   next.startsWith("/") && !next.startsWith("//")
 *
 * Bu yetarli emas, chunki brauzer manzilni satr sifatida emas, URL
 * qoidasi bo'yicha o'qiydi va u yerda teskari chiziq oldinga chiziqqa
 * TENG:
 *
 *   new URL("/\\begona.example", "https://searcher-ai.uz")
 *     → https://begona.example/
 *
 * Ya'ni `?next=/\begona.example` tekshiruvdan o'tardi (`/` bilan
 * boshlanadi, `//` bilan emas), lekin foydalanuvchini BEGONA saytga
 * olib chiqardi. Tab va yangi qator belgilari ham xuddi shunday ishlaydi
 * — URL tahlilchisi ularni tashlab yuboradi.
 *
 * ── Nega bu muhim ─────────────────────────────────────────────────────────
 * Hujumchi haqiqiy domendagi havolani tarqatadi. O'qituvchi manzil
 * satrida O'Z saytini ko'radi, parolini kiritadi — va kirish
 * muvaffaqiyatli bo'lgach hujumchining sahifasiga tushadi. U yerda
 * "sessiya tugadi, parolni qayta kiriting" degan soxta forma kutadi.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * Satrga qaramaymiz: manzilni brauzer BILAN BIR XIL qoidada yechamiz va
 * origin o'zgarmaganiga ishonch hosil qilamiz. Qaytariladigan qiymat ham
 * qayta yig'iladi (`pathname + search + hash`), ya'ni keyingi qatlamga
 * har doim SOF ichki yo'l tushadi.
 *
 * Bu Next.js hujjatidagi ogohlantirishga ham javob beradi: `router.push`
 * va `router.replace` ga tekshirilmagan manzil berish mumkin emas —
 * `javascript:` manzili o'sha yerda BAJARILADI.
 */

/**
 * Yechish uchun soxta baza.
 *
 * Haqiqiy origin kerak emas va undan foydalanib ham bo'lmaydi: bu kod
 * serverda ham (SSR) ishlaydi, u yerda `window` yo'q. Muhimi origin
 * O'ZGARMAGANI, qaysi origin ekani emas.
 */
const BASE = "http://ichki.tekshiruv";

/** `next` bo'sh yoki xavfli bo'lganda qaytariladigan manzil. */
export const DEFAULT_REDIRECT = "/dashboard";

export function safeInternalPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (value === null || value === undefined || value === "") return fallback;

  let resolved: URL;
  try {
    resolved = new URL(value, BASE);
  } catch {
    // Umuman yechilmaydigan manzil — ishonchsiz.
    return fallback;
  }

  /*
    Origin o'zgargan bo'lsa — manzil ichki emas.

    Bu `//begona`, `/\begona`, `https://begona` va `javascript:` ning
    hammasini bir qoida bilan to'sadi: oxirgisida origin `"null"`
    bo'ladi.
  */
  if (resolved.origin !== BASE) return fallback;

  /*
    Qiymat QAYTA yig'iladi, asl satr uzatilmaydi.

    Shunda keyingi qatlamga har doim normallashtirilgan ichki yo'l
    tushadi va `\`, tab yoki boshqa belgi u yerda qayta talqin
    qilinmaydi.
  */
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
