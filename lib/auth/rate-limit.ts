import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

/**
 * Kirish urinishlarini cheklash — brute-force himoyasi.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Ilgari `POST /api/auth/login` cheksiz urinishga ochiq edi. Yagona
 * to'siq — bcrypt sekinligi (~250ms), ya'ni soatiga ~14 000 urinish.
 * Oddiy parolli hisob bir kechada topiladi.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * 5 daqiqalik oynada 5 ta muvaffaqiyatsiz urinishdan keyin 429.
 * Muvaffaqiyatli kirishda hisoblagich tozalanadi.
 *
 * IKKI o'lchov bo'yicha alohida hisoblanadi:
 *  · email — bitta hisobga qaratilgan hujum
 *  · IP    — bitta manzildan ko'p emailga hujum (email o'zgartirib
 *            aylanib o'tishning oldini oladi)
 *
 * ── Cheklovlar (ataylab) ──────────────────────────────────────────────────
 * Bu bazaga asoslangan oddiy hisoblagich, taqsimlangan tizim uchun
 * mo'ljallangan yechim emas. Proksi orqasida IP `x-forwarded-for` dan
 * olinadi — uni soxtalashtirish mumkin, shuning uchun email bo'yicha
 * cheklov asosiy himoya, IP esa qo'shimcha qatlam.
 */

/** Oyna uzunligi. */
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Oyna ichida ruxsat etilgan muvaffaqiyatsiz urinishlar — o'lchov bo'yicha.
 *
 * ── Nega IP chegarasi ANCHA yuqori ────────────────────────────────────────
 * Ikkalasi ham 5 bo'lsa, amalda quyidagi holat yuzaga keladi: bitta
 * maktabdagi barcha o'qituvchilar bitta tashqi IP ortida ishlaydi (NAT).
 * Bitta o'qituvchi parolini uch marta xato yozsa, BUTUN MAKTAB bloklanadi
 * — bu hujumdan ko'ra ko'proq zarar keltiradi.
 *
 * Shuning uchun:
 *  · email — 5. Bitta hisobga qaratilgan hujumni deyarli darhol to'xtatadi.
 *  · IP    — 30. Bitta maktab uchun bemalol yetadi, lekin bitta manzildan
 *            yuzlab emailni sinab ko'rishga yo'l qo'ymaydi.
 */
const MAX_ATTEMPTS: Record<string, number> = {
  email: 5,
  ip: 30,
};

/**
 * Eski yozuvlar shundan keyin tozalanadi.
 *
 * Oynadan uzunroq: yaqin o'tmishdagi urinishlar diagnostika uchun bir
 * muddat qolsin, lekin jadval cheksiz o'smasin.
 */
const CLEANUP_AFTER_MS = 60 * 60 * 1000;

/** So'rov yuborgan manzil. Topilmasa `null`. */
async function clientIp(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
    return requestHeaders.get("x-real-ip");
  } catch {
    // So'rov konteksti yo'q (masalan sinovda to'g'ridan-to'g'ri chaqiruv).
    return null;
  }
}

/** Tekshiriladigan o'lchovlar ro'yxati. */
async function identifiers(
  email: string,
): Promise<Array<{ identifier: string; kind: string }>> {
  const list = [{ identifier: email.toLowerCase(), kind: "email" }];

  const ip = await clientIp();
  if (ip !== null && ip !== "") list.push({ identifier: ip, kind: "ip" });

  return list;
}

/**
 * Kirishga ruxsat bormi — muvaffaqiyatsiz urinishlar chegaradan
 * oshgan bo'lsa `ApiError` (429) tashlaydi.
 *
 * Parolni tekshirishdan OLDIN chaqiriladi.
 */
export async function assertLoginAllowed(email: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const keys = await identifiers(email);

  /*
    Har bir o'lchov ALOHIDA sanaladi.

    Ilgari ikkalasi birga sanalar edi — natijada IP bo'yicha yig'ilgan
    urinishlar email chegarasini ham "yeb qo'yardi".
  */
  const counts = await Promise.all(
    keys.map(async (key) => ({
      kind: key.kind,
      count: await prisma.loginAttempt.count({
        where: {
          identifier: key.identifier,
          kind: key.kind,
          createdAt: { gte: since },
        },
      }),
    })),
  );

  const exceeded = counts.find((entry) => entry.count >= (MAX_ATTEMPTS[entry.kind] ?? 5));

  if (exceeded) {
    /*
      429 — «juda ko'p so'rov». Foydalanuvchiga ko'rsatiladigan xabar
      ATAYLAB umumiy: hujumchiga qaysi o'lchov ishlaganini aytmaymiz.
      Texnik tafsilot faqat logga ketadi.
    */
    throw new ApiError("too_many_requests", {
      messageKey: "errors.domain.tooManyLoginAttempts",
      detail: `login rate limit: ${exceeded.kind} = ${exceeded.count}`,
    });
  }
}

/** Muvaffaqiyatsiz urinishni yozadi. */
export async function recordFailedLogin(email: string): Promise<void> {
  const keys = await identifiers(email);

  await prisma.loginAttempt
    .createMany({ data: keys.map((key) => ({ ...key })) })
    // Hisoblagich yozilmasa ham kirish oqimi to'xtamasligi kerak —
    // bu himoya qatlami, asosiy funksiya emas.
    .catch((error: unknown) => {
      console.error("[rate-limit] urinishni yozib bo'lmadi:", error);
    });

  await cleanupOldAttempts();
}

/** Muvaffaqiyatli kirishdan keyin hisoblagichni tozalaydi. */
export async function clearLoginAttempts(email: string): Promise<void> {
  const keys = await identifiers(email);

  await prisma.loginAttempt
    .deleteMany({ where: { identifier: { in: keys.map((key) => key.identifier) } } })
    .catch(() => undefined);
}

/**
 * Eskirgan yozuvlarni o'chiradi.
 *
 * Alohida cron kerak emas: tozalash yozish yo'lida bajariladi va u
 * kamdan-kam (faqat muvaffaqiyatsiz urinishda) ishga tushadi.
 */
async function cleanupOldAttempts(): Promise<void> {
  await prisma.loginAttempt
    .deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - CLEANUP_AFTER_MS) } },
    })
    .catch(() => undefined);
}
