import { headers } from "next/headers";

/**
 * So'rov yuborgan mijozning manzili — ISHONCHLI manbadan.
 *
 * ── Nega alohida fayl ─────────────────────────────────────────────────────
 * Manzil ikki joyda kerak: tezlik cheklovida (`lib/auth/rate-limit.ts`) va
 * sessiya yozuvida (`lib/auth/session.ts`). Ilgari ikkalasi o'z nusxasini
 * yozgan edi va ikkalasi ham bir xil xatoga yo'l qo'ygandi. Qoida bitta
 * joyda tursa, u bir marta to'g'rilanadi.
 *
 * ── Muammo: `X-Forwarded-For` ni MIJOZ boshqaradi ─────────────────────────
 * Nginx bu sarlavhani `$proxy_add_x_forwarded_for` bilan qo'yadi va bu
 * ataylab QO'SHIMCHA qiladi: mijoz yuborgan qiymatning OXIRIGA haqiqiy
 * manzilni ulaydi. Ya'ni hujumchi
 *
 *   X-Forwarded-For: 1.2.3.4
 *
 * yuborsa, ilovaga
 *
 *   X-Forwarded-For: 1.2.3.4, <haqiqiy manzil>
 *
 * yetib keladi. Ilgari kod BIRINCHI elementni olardi — ya'ni to'g'ridan-
 * to'g'ri hujumchi yozgan qiymatni. Har so'rovda uni o'zgartirib, IP
 * bo'yicha har qanday cheklovni (jumladan ro'yxatdan o'tish kvotasini,
 * ya'ni AI xarajatining yagona to'sig'ini) butunlay chetlab o'tish mumkin edi.
 *
 * ── Qoida ─────────────────────────────────────────────────────────────────
 *  1. `X-Real-IP` — Nginx uni `$remote_addr` dan oladi va mijoz yuborgan
 *     qiymatni ALMASHTIRADI (qo'shmaydi). Proksi ortida bu yagona
 *     ishonchli manba, shuning uchun u birinchi.
 *  2. `X-Forwarded-For` ning OXIRGI elementi — zaxira. Nginx qo'shimcha
 *     qilgani uchun oxirgi element har doim eng yaqin proksi ko'rgan
 *     manzil bo'ladi. Birinchi element esa har doim soxtalashtiriladi.
 *  3. Topilmasa `null`.
 *
 * ── Chegara (halol aytilishi kerak) ───────────────────────────────────────
 * Bu qoida ilova ISHONCHLI proksi ortida turganini nazarda tutadi. Agar
 * ilova to'g'ridan-to'g'ri internetga ochilsa, hech qanday sarlavha
 * ishonchli emas — u holda himoya `$remote_addr` darajasida bo'lishi
 * kerak. Bizning joylashtirishda (docker-compose.prod.yml) ilova
 * `expose:` bilan faqat ichki tarmoqda va Nginx yagona kirish nuqtasi.
 */

/**
 * Manzilning eng uzun matn shakli — IPv6 + IPv4 aralash yozuv
 * ("::ffff:255.255.255.255" = 45 belgi).
 */
const MAX_IP_LENGTH = 45;

/**
 * Manzilda uchrashi mumkin bo'lgan belgilar.
 *
 * Nega tekshiriladi: bu qiymat bazadagi `LoginAttempt.identifier`
 * ustuniga yoziladi. Tekshiruvsiz hujumchi sarlavhaga istalgan matnni
 * (masalan 8 KB axlat) qo'yib, jadvalni shishirishi mumkin edi.
 */
const IP_SHAPE = /^[0-9a-fA-F.:]+$/;

/**
 * Manzilni tozalaydi va shaklini tekshiradi. Yaroqsiz bo'lsa `null`.
 *
 * `[::1]` ko'rinishidagi qavslar va `%eth0` zona qo'shimchasi olib
 * tashlanadi — ular bir xil manzilning boshqa yozuvi, lekin hisoblagich
 * uchun BOSHQA kalit bo'lib qolardi.
 */
function normalizeIp(value: string): string | null {
  let ip = value.trim();
  if (ip === "") return null;

  // "[::1]:443" yoki "[::1]" → "::1"
  const bracketed = /^\[([^\]]+)\]/.exec(ip);
  if (bracketed) ip = bracketed[1];

  // IPv6 zona identifikatori: "fe80::1%eth0" → "fe80::1"
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);

  ip = ip.trim();
  if (ip === "" || ip.length > MAX_IP_LENGTH) return null;
  if (!IP_SHAPE.test(ip)) return null;

  return ip;
}

/**
 * Sarlavhalardan mijoz manzilini tanlaydi.
 *
 * SOF funksiya — `next/headers` ga bog'liq emas, shuning uchun uni
 * so'rov kontekstisiz sinash mumkin (`tests/client-ip.test.ts`).
 */
export function pickClientIp(requestHeaders: Headers): string | null {
  const realIp = requestHeaders.get("x-real-ip");
  if (realIp !== null) {
    const normalized = normalizeIp(realIp);
    if (normalized !== null) return normalized;
  }

  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded !== null) {
    /*
      OXIRIDAN boshlab qidiramiz.

      Nginx haqiqiy manzilni oxiriga qo'shadi, ya'ni ishonchli qiymat
      shu yerda. Oxirgi element yaroqsiz bo'lsa (bo'sh, buzuq) undan
      oldingisiga o'tamiz — bu "ishonch" nuqtai nazaridan xavfsiz
      tomonga qarab siljish emas, shuning uchun faqat SHAKLI buzuq
      bo'lganlar tashlab yuboriladi.
    */
    const parts = forwarded.split(",");
    for (let index = parts.length - 1; index >= 0; index--) {
      const normalized = normalizeIp(parts[index]);
      if (normalized !== null) return normalized;
    }
  }

  return null;
}

/**
 * Joriy so'rovning mijoz manzili. So'rov konteksti bo'lmasa `null`.
 *
 * `null` qaytishi cheklovni O'CHIRADI (chaqiruvchilarga qarang) — bu
 * ataylab: sinovda va mahalliy ishlab chiqishda sarlavhalar bo'lmasligi
 * mumkin, productionda esa Nginx ularni doim qo'yadi.
 */
export async function clientIp(): Promise<string | null> {
  try {
    return pickClientIp(await headers());
  } catch {
    // So'rov konteksti yo'q (masalan sinovda to'g'ridan-to'g'ri chaqiruv).
    return null;
  }
}
