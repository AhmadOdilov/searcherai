import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

/**
 * AI so'rovlari tezligini cheklash.
 *
 * ── Muammo: bu PUL yo'qotish xavfi ────────────────────────────────────────
 * Har bir generatsiya AI provayderiga to'lanadigan so'rov. Cheklovsiz
 * holda tizimga kirgan ISTALGAN foydalanuvchi (o'z hisobini yaratib)
 * quyidagini yoza olardi:
 *
 *   while (true) fetch("/api/search", { method: "POST", ... })
 *
 * Bir kechada hisobdagi mablag' tugaydi. Bu nazariy xavf emas: fon
 * rejimi tufayli so'rov DARHOL 202 qaytaradi, ya'ni sikl hech narsani
 * kutmaydi va soniyada o'nlab so'rov yuborishi mumkin.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * Bitta foydalanuvchi uchun daqiqada eng ko'pi 3 ta AI so'rovi.
 * Chegaradan oshsa — 429 va tushunarli xabar.
 *
 * ── Nega 3 ta ─────────────────────────────────────────────────────────────
 * Haqiqiy o'qituvchining eng tez ish ritmi: dars ishlanmasi yasadi,
 * natija yoqmadi — qayta yaratdi, so'ng prezentatsiya so'radi. Bu uchta
 * so'rov, lekin ular orasida o'qish va kutish bor, ya'ni amalda bir
 * daqiqaga sig'maydi. Hujum esa soniyada o'nlab so'rov yuboradi va
 * darhol to'xtaydi.
 *
 * ── Nega alohida jadval, `LoginAttempt` emas ─────────────────────────────
 * Ikkisi boshqa narsani sanaydi: `LoginAttempt` faqat MUVAFFAQIYATSIZ
 * urinishlarni yozadi va muvaffaqiyatli kirishda tozalanadi; bu yerda
 * esa BARCHA so'rovlar sanaladi va hech qachon tozalanmaydi. Bitta
 * jadvalga birlashtirish ikkala mantiqni chalkashtirar va ishlab
 * turgan xavfsizlik kodiga tegishni talab qilardi.
 *
 * ── Cheklovlar (ataylab) ──────────────────────────────────────────────────
 * Sanash va yozish atomar EMAS: bir vaqtda kelgan ikki so'rov ikkalasi
 * ham o'tib ketishi mumkin. Haqiqiy himoya uchun bu yetarli — hujum
 * o'nlab so'rov yuboradi va to'rtinchisida to'xtaydi. Atomar hisoblagich
 * uchun Redis yoki `SELECT ... FOR UPDATE` kerak bo'lardi; bitta VPS'dagi
 * MVP uchun bu ortiqcha murakkablik.
 */

/** Oyna uzunligi. */
const WINDOW_MS = 60 * 1000;

/** Oyna ichida bitta foydalanuvchiga ruxsat etilgan so'rovlar soni. */
const MAX_REQUESTS = 3;

/**
 * Eskirgan yozuvlar shundan keyin tozalanadi.
 *
 * Oynadan ancha uzun: `npm run ai:stats` kabi diagnostika uchun yaqin
 * o'tmish qolsin, lekin jadval cheksiz o'smasin.
 */
const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Band qilingan kvota — generatsiya yiqilsa uni qaytarish uchun.
 *
 * Obyekt sifatida (oddiy satr emas): chaqiruvchi uni tasodifan boshqa
 * identifikator bilan almashtirib yubormasligi uchun.
 */
export interface QuotaReservation {
  id: string;
}

/** Qaysi modul so'rayotgani — faqat diagnostika uchun yoziladi. */
export type AiRoute =
  | "lesson-plans"
  | "lesson-plans:regenerate"
  | "presentations"
  | "presentations:regenerate"
  | "calendar-plans"
  | "calendar-plans:regenerate"
  | "search"
  | "vision";

/**
 * Kvotadan bitta so'rov "yeydi".
 *
 * Chegaradan oshgan bo'lsa `ApiError` (429) tashlaydi, aks holda
 * so'rovni yozib, qaytadi.
 *
 * ── Nega tekshirish va yozish BIR funksiyada ──────────────────────────────
 * Ular alohida bo'lsa, yangi route yozgan dasturchi tekshirishni
 * qo'shib, yozishni unutishi mumkin — va cheklov jim ishlamay qolardi.
 * Bitta chaqiruv bunday xatoni imkonsiz qiladi.
 *
 * AI so'rovi BOSHLANISHIDAN oldin chaqiriladi: xarajat so'rov
 * yuborilganda paydo bo'ladi, natija kelganda emas.
 */
export async function consumeAiQuota(
  userId: string,
  route: AiRoute,
): Promise<QuotaReservation> {
  const since = new Date(Date.now() - WINDOW_MS);

  /*
    ── Nega TRANZAKSIYA va QULF ─────────────────────────────────────────────
    Ilgari bu yerda ikki alohida so'rov turardi: avval `count()`, keyin
    `create()`. Ikkisi orasida oyna bor va bir vaqtda kelgan
    so'rovlarning HAMMASI "hali uchta emas" holatini ko'rardi.

    Auditda bu production artefaktida har safar takrorlandi: o'nta
    parallel so'rovdan uchta emas, 4 / 6 / 7 / 8 / 9 tasi qabul
    qilindi. Chegarani chetlab o'tish uchun so'rovlarni shunchaki bir
    vaqtda yuborish yetarli edi.

    DIQQAT: `next dev` da bu KO'RINMAYDI — u so'rovlarni sekinroq
    ishlaydi va oyna ochilmaydi. Shuning uchun regressiya sinovi
    smoke to'plamida (`tests/smoke/shared/security.smoke.ts`), e2e
    qatlamida emas.

    ── Nega shunchaki tartibni almashtirish YETMAYDI ────────────────────────
    "Avval yoz, keyin o'z navbatingni sana" varianti ishonchli emas:
    har bir yozuv ALOHIDA tranzaksiyada va biri ikkinchisi COMMIT
    qilgunicha uni KO'RMAYDI. Ya'ni keyin kelgan so'rov o'zidan
    oldingilarni sanamay, navbatini past deb hisoblab o'tib ketishi
    mumkin — poyga torayadi, lekin yopilmaydi.

    Yagona ishonchli yo'l — sanash va yozishni BITTA tranzaksiyada,
    foydalanuvchi bo'yicha qulf ostida bajarish.

    ── Nega `pg_advisory_xact_lock` ─────────────────────────────────────────
    Qulf FOYDALANUVCHI bo'yicha: boshqa o'qituvchilarning so'rovlari
    bir-birini kutmaydi. Tranzaksiya tugashi bilan qulf o'zi
    bo'shaydi — qo'lda ochish kerak emas, xato bo'lsa ham osilib
    qolmaydi.

    Yangi infratuzilma kerak emas: bu Postgres'ning o'z imkoniyati.
  */
  const reservation = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const used = await tx.aiRequest.count({
      where: { userId, createdAt: { gte: since } },
    });

    if (used >= MAX_REQUESTS) {
      throw new ApiError("too_many_requests", {
        messageKey: "errors.domain.tooManyAiRequests",
        detail: `ai rate limit: user=${userId} route=${route} used=${used}`,
      });
    }

    return tx.aiRequest.create({
      data: { userId, route },
      select: { id: true },
    });
  });

  await cleanupOldRequests();

  return { id: reservation.id };
}

/**
 * Bandlikni QAYTARADI — generatsiya muvaffaqiyatsiz tugaganda.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * `consumeAiQuota()` so'rov BOSHLANISHIDAN oldin yozadi va bu to'g'ri:
 * aks holda parallel so'rovlar chegarani chetlab o'tardi. Lekin AI
 * yiqilganda, timeout bo'lganda yoki javob sxemadan o'tmaganda bandlik
 * o'sha joyda qolib ketardi.
 *
 * Amaliy oqibat: provayder uzilgan paytda o'qituvchi uch marta urinadi,
 * uchalasi ham yiqiladi va u BIR DAQIQAGA bloklanadi — o'z aybisiz.
 * Ya'ni provayder nosozligi foydalanuvchi uchun ikki barobar og'irlashardi.
 *
 * ── Nega tekshiruv OXIRIGA ko'chirilmadi ──────────────────────────────────
 * "Generatsiya tugagach hisobla" degan variant soddaroq ko'rinadi, lekin
 * u parallel himoyani buzadi: bir vaqtda kelgan o'nta so'rov hammasi
 * "hali hech narsa yozilmagan" holatni ko'rib, o'tib ketardi. Shuning
 * uchun band qilish oldinda qoladi, faqat MUVAFFAQIYATSIZLIKDA qaytariladi.
 *
 * ── Idempotent ────────────────────────────────────────────────────────────
 * `deleteMany` ishlatiladi, `delete` emas: yozuv allaqachon o'chirilgan
 * bo'lsa (takroriy chaqiruv yoki eskirganlarni tozalash) funksiya jim
 * o'tadi, xato tashlamaydi.
 *
 * ── Nega FAQAT sarflanmagan bandlik qaytariladi ───────────────────────────
 * Generatsiya AI'dan KEYIN ham yiqilishi mumkin: .pptx yasalmadi, fayl
 * saqlanmadi, baza javob bermadi. Bunday holatda AI so'rovi ALLAQACHON
 * bajarilgan va provayder uni hisobga qo'shgan.
 *
 * Ilgari yozuv baribir o'chirilardi va bu ikki xatoga olib kelardi:
 *  · sarflangan tokenlar yozuvi yo'qolardi — pul ketgan, iz qolmagan;
 *  · kvota qaytarilardi, ya'ni foydalanuvchi darhol qayta urinib,
 *    xarajatni ikki barobar qila olardi.
 *
 * Shuning uchun shart qo'shildi: `model` maydoni bo'sh bo'lsa GINA
 * o'chiriladi. U `recordAiUsage()` da to'ldiriladi, ya'ni bo'sh bo'lishi
 * "AI javobi umuman kelmagan" degani — sarflanmagan bandlik.
 */
export async function releaseAiQuota(
  reservation: QuotaReservation | undefined,
): Promise<void> {
  if (reservation === undefined) return;

  await prisma.aiRequest
    .deleteMany({ where: { id: reservation.id, model: null } })
    .catch((error: unknown) => {
      // Qaytarish bajarilmagani generatsiya xatosini YASHIRMASLIGI kerak —
      // chaqiruvchi baribir asl xatoni yuqoriga uzatadi.
      console.error("[rate-limit] kvota qaytarilmadi:", error);
    });
}

/**
 * Band qilingan yozuvga AI o'lchovlarini yozadi — generatsiya TUGAGACH.
 *
 * ── Nega alohida qadam ────────────────────────────────────────────────────
 * Kvota yozuvi so'rov BOSHLANISHIDAN oldin yaratiladi (parallel himoya
 * uchun), model va tokenlar esa javob kelganda ma'lum bo'ladi. Ularni
 * bir chaqiruvga birlashtirib bo'lmaydi.
 *
 * ── Nega bu ma'lumot kerak ────────────────────────────────────────────────
 * Bugungi kvota faqat daqiqalik va u so'rovlarni SANAYDI. Bitta hisob
 * kuniga 4 320 generatsiya qila oladi va ularning haqiqiy og'irligi
 * noma'lum: qisqa savol ham, 24 haftalik reja ham bitta so'rov.
 *
 * Tokenlar saqlangach kunlik/oylik kvota va model bo'yicha taqqoslash
 * mumkin bo'ladi. Tokenlarning O'ZI hech narsani cheklamaydi — bu
 * o'lchov, siyosat emas.
 *
 * ── Nega XARAJAT hisoblanmaydi ────────────────────────────────────────────
 * Narx provayderga, modelga, tarifga va vaqtga bog'liq. Bazaga yozilgan
 * "$0.0031" bir necha oydan keyin yolg'onga aylanadi. Tokenlar esa
 * o'zgarmaydi — xarajat kerak bo'lganda joriy narx bilan hisoblanadi.
 *
 * Xato YUTILADI: o'lchov yozilmagani generatsiyaga aloqasi yo'q.
 */
export async function recordAiUsage(
  reservation: QuotaReservation | undefined,
  usage: { model: string; inputTokens: number; outputTokens: number },
): Promise<void> {
  if (reservation === undefined) return;

  await prisma.aiRequest
    .updateMany({
      where: { id: reservation.id },
      data: {
        model: usage.model,
        /*
          Nol qiymat `null` bo'lib yoziladi: ba'zi provayderlar `usage`
          bermaydi va transport 0 qaytaradi. "0 token ishlatildi" degan
          yozuv "ma'lumot yo'q" dan boshqa narsani anglatadi — ularni
          aralashtirmaymiz.
        */
        inputTokens: usage.inputTokens > 0 ? usage.inputTokens : null,
        outputTokens: usage.outputTokens > 0 ? usage.outputTokens : null,
      },
    })
    .catch((error: unknown) => {
      console.warn("[rate-limit] AI o'lchovi yozilmadi:", error);
    });
}

/**
 * Eskirgan yozuvlarni o'chiradi.
 *
 * Alohida cron kerak emas: tozalash yozish yo'lida bajariladi.
 * Xato bo'lsa jim o'tiladi — tozalash ishlamagani foydalanuvchining
 * so'rovini to'xtatishi kerak emas.
 */
async function cleanupOldRequests(): Promise<void> {
  await prisma.aiRequest
    .deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - CLEANUP_AFTER_MS) } },
    })
    .catch(() => undefined);
}
