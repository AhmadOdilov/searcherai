import "server-only";
import { ApiError } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";

/**
 * CSRF himoyasi — `Origin` sarlavhasi tekshiruvi.
 *
 * ── Hujum ─────────────────────────────────────────────────────────────────
 * Foydalanuvchi bizning saytga kirgan va sessiya cookie'si brauzerida
 * turibdi. So'ng u begona sahifani ochadi, u yerda esa yashirin forma:
 *
 *   <form action="https://searcher-ai.uz/api/lesson-plans" method="POST">
 *
 * Brauzer bu so'rovga COOKIE'ni ham qo'shib yuboradi — ya'ni so'rov
 * foydalanuvchi nomidan bajariladi. U hech narsani bosmagan bo'lsa ham.
 *
 * ── Nega `sameSite: "lax"` yetarli emas ───────────────────────────────────
 * Sessiya cookie'si allaqachon `sameSite: "lax"` bilan qo'yiladi va bu
 * yuqoridagi hujumning ASOSIY qismini to'sadi. Lekin u to'liq himoya
 * emas:
 *
 *  · "lax" — brauzer sozlamasi, server kafolati emas. Eski yoki g'alati
 *    brauzerlarda boshqacha ishlashi mumkin.
 *  · Ayni saytning boshqa subdomeni (masalan buzilgan blog.searcher-ai.uz)
 *    "same-site" hisoblanadi va cookie ketaveradi.
 *  · Himoya bitta cookie sozlamasiga tayanib turadi: kimdir uni
 *    "none" ga o'zgartirsa, butun ilova jim ochilib qoladi.
 *
 * `Origin` tekshiruvi esa SERVER tomonida va aniq: so'rov qayerdan
 * kelganini brauzer o'zi aytadi va uni JavaScript bilan soxtalashtirib
 * bo'lmaydi.
 *
 * ── Nega GET tekshirilmaydi ───────────────────────────────────────────────
 * GET hech narsani o'zgartirmasligi kerak (va bu ilovada o'zgartirmaydi).
 * Tekshirsak, brauzerga oddiy havola bilan kirishni ham buzardik.
 */

/** Tekshiriladigan metodlar — holatni o'zgartiradiganlari. */
const GUARDED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * So'rov ruxsat etilgan manbadanmi — aks holda `ApiError` (403).
 *
 * ── `Origin` YO'Q bo'lsa nima bo'ladi ─────────────────────────────────────
 * So'rov O'TADI. Sabab: `Origin` ni faqat BRAUZER qo'yadi. U yo'q bo'lsa,
 * so'rov brauzerdan emas — `curl`, mobil ilova, server-to-server
 * chaqiruv yoki sinov. Bunday so'rovlarda CSRF tushunchasi umuman yo'q:
 * hujumning butun kuchi begona sahifa foydalanuvchining cookie'sidan
 * foydalana olishida edi.
 *
 * Ularni rad etish xavfsizlikka hech narsa qo'shmas, lekin kelajakdagi
 * mobil ilovani va `curl` bilan diagnostikani buzardi.
 */
export function assertSameOrigin(request: Request): void {
  if (!GUARDED_METHODS.has(request.method.toUpperCase())) return;

  const origin = request.headers.get("origin");
  if (origin === null || origin === "") return;

  const expected = allowedOrigin();
  if (origin === expected) return;

  throw new ApiError("forbidden", {
    messageKey: "errors.domain.crossOriginRejected",
    detail: `csrf: origin=${origin} expected=${expected}`,
  });
}

/**
 * Ruxsat etilgan yagona manba — `APP_URL` dan olinadi.
 *
 * ── Nega `Host` sarlavhasidan emas ────────────────────────────────────────
 * `Host` ni hujumchi o'zi belgilaydi (u so'rovning bir qismi), ya'ni
 * o'zini o'zi tasdiqlagan bo'lardi. `APP_URL` esa serverning o'z
 * sozlamasi — tashqaridan o'zgartirib bo'lmaydi.
 *
 * Faqat sxema + host + port solishtiriladi: `APP_URL` da yo'l yoki
 * oxirgi "/" bo'lsa ham tekshiruv buzilmasin.
 */
function allowedOrigin(): string {
  return new URL(getEnv().APP_URL).origin;
}
