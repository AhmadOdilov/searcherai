import "server-only";
import { after } from "next/server";
import { createLogger, describeError } from "@/lib/observability/log";

const log = createLogger("fon");

/**
 * Generatsiyani FON rejimida bajarish.
 *
 * ── Nima o'zgardi ─────────────────────────────────────────────────────────
 * Ilgari POST route AI javobini kutardi: dars ishlanmasi ~15s, prezentatsiya
 * ~25s, kalendar reja ~50s. Foydalanuvchi shu vaqt davomida jim o'tirardi
 * va brauzer "sahifa javob bermayapti" deb ko'rsatishi mumkin edi.
 *
 * Endi route PENDING yozuvni yaratib DARHOL `202 Accepted` qaytaradi,
 * generatsiya esa javob yuborilgandan keyin davom etadi. Frontend yozuvni
 * so'rab turadi (polling).
 *
 * ── Nega `after()`, navbat (queue) emas ───────────────────────────────────
 * Uchta variant ko'rib chiqildi:
 *
 *  1. `after()` — Next.js'ning O'Z primitivi. Javob yuborilgandan keyin
 *     ishlaydi, qo'shimcha xizmat talab qilmaydi. TANLANDI.
 *
 *  2. Oddiy "fire and forget" (`void doWork()`) — kod jihatdan bir xil,
 *     lekin Next.js javob tugagach ishni to'xtatib qo'yishi mumkin.
 *     `after()` aynan shu muammoni hal qiladi: u ishni ro'yxatga oladi va
 *     tugashini kutadi.
 *
 *  3. Redis + BullMQ — to'g'ri, kengaytiriladigan yechim, lekin yangi
 *     xizmat, yangi deploy va yangi nosozlik nuqtasi. MVP muddatiga
 *     arzimaydi. Bazadagi `status` ustuni allaqachon navbat vazifasini
 *     bajaradi (PENDING → READY/FAILED).
 *
 * ── `after()` ning cheklovi ───────────────────────────────────────────────
 * U bir xil so'rov chaqiruvi ichida ishlaydi, ya'ni platformaning
 * `maxDuration` chegarasiga bo'ysunadi. Shuning uchun generatsiya
 * route'larida `maxDuration` ataylab oshirilgan. Serverless'da (Vercel)
 * bu chegara tarif rejasiga bog'liq; VPS'da chegara yo'q.
 *
 * Agar chegara yetmasa, yozuv PENDING holatida qolib ketadi —
 * `markStaleAsFailed()` uni keyinroq FAILED qiladi.
 */

/**
 * Ishni javob yuborilgandan keyin bajaradi.
 *
 * Callback ichidagi xatolik YUTILADI: u javobga ta'sir qila olmaydi
 * (javob allaqachon ketgan) va ishlov beruvchining o'zi yozuvni FAILED
 * qilishi kerak. Bu yerda faqat loglaymiz.
 */
export function runInBackground(label: string, work: () => Promise<unknown>): void {
  after(async () => {
    const startedAt = Date.now();
    try {
      await work();
      log.info("tugadi", { generationId: label, durationMs: Date.now() - startedAt });
    } catch (error) {
      // Bu yerga faqat ishlov beruvchi o'zi ushlamagan xatolik yetadi.
      log.error(describeError(error), {
        generationId: label,
        durationMs: Date.now() - startedAt,
      });
    }
  });
}

/**
 * Generatsiya route'lari uchun maksimal davomiylik, soniyada.
 *
 * Kalendar reja eng uzuni (~60s), ustiga qayta urinish ehtimoli va
 * fayl yasash vaqti — shuning uchun zaxira bilan olingan.
 *
 * DIQQAT: route'lar bu konstantani IMPORT QILA OLMAYDI. Next.js segment
 * sozlamalarini (`export const maxDuration`) build paytida STATIK o'qiydi
 * va import qilingan identifikatorni hisoblay olmaydi — natijada
 * "Invalid segment configuration export" xatosi chiqadi. Shuning uchun
 * har bir route'da qiymat literal sifatida yozilgan va bu yerga havola
 * qilingan.
 */
export const GENERATION_MAX_DURATION = 300;
