/**
 * Server ishga tushganda bir marta bajariladigan ish.
 *
 * ── Nega bu fayl kerak bo'ldi ─────────────────────────────────────────────
 * Generatsiya `after()` ichida, ya'ni so'rov jarayoniga bog'langan holda
 * bajariladi. Deploy yoki qayta ishga tushish paytida o'sha jarayon
 * o'ladi va ishlayotgan generatsiyalar PENDING holatida qolib ketadi.
 *
 * Ilgari ularni faqat EGASI sahifaga qaytganda tozalash mumkin edi. Agar
 * o'qituvchi qaytmasa, yozuv mangu "Tayyorlanmoqda" bo'lib turardi.
 *
 * `register()` — Next.js'ning O'Z primitivi: yangi server nusxasi
 * ishga tushganda BIR MARTA chaqiriladi va u tugamaguncha server
 * so'rovlarni qabul qilmaydi. Bu aynan bizga kerak bo'lgan nuqta:
 * eski jarayon qoldirgan ishlarni yangisi darhol tozalaydi.
 *
 * ── Nega cron yoki navbat emas ────────────────────────────────────────────
 * Loyihada rejalashtiruvchi yo'q va bu yerda soxtasi yaratilmadi.
 * Muammoning o'zi ham navbat talab qilmaydi — u bitta `updateMany`
 * so'roviga sig'adi. Yangi xizmat qo'shish yangi nosozlik nuqtasi
 * qo'shish demakdir.
 */
export async function register(): Promise<void> {
  /*
    Faqat Node.js runtime'da.

    `instrumentation.ts` Edge runtime'da ham chaqiriladi, u yerda esa
    Prisma va baza ulanishi mavjud emas — import qilishga urinish
    xato beradi.
  */
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  /*
    Dinamik import ATAYLAB: statik import bu modulni Edge bundle'iga
    ham tortib kelardi.
  */
  const { recoverStaleGenerations } = await import("@/lib/generation/stale");
  const { pruneExpiredConversations } = await import("@/lib/search/conversation-store");

  try {
    await recoverStaleGenerations();

    /*
      Eskirgan qidiruv suhbatlari (30 kun tegilmagan) shu yerda tozalanadi.

      Nega aynan shu nuqta: yuqoridagi sabab bilan bir xil — loyihada
      rejalashtiruvchi yo'q va uning soxtasi yaratilmadi. Tozalash bitta
      `deleteMany` ga sig'adi, xabarlar esa `onDelete: Cascade` bilan
      o'zi ketadi. Server kamdan-kam qayta ishga tushsa, jadval biroz
      uzoqroq to'la turadi — bu xavf emas, faqat joy.
    */
    const pruned = await pruneExpiredConversations();
    if (pruned > 0) {
      console.log(`[fon] ${pruned} ta eskirgan qidiruv suhbati tozalandi`);
    }
  } catch (error) {
    /*
      Tozalash ishlamagani serverni ko'tarilishiga TO'SQINLIK QILMASLIGI
      kerak. `register()` xato tashlasa, Next.js ishga tushmaydi — ya'ni
      baza vaqtincha yetib bo'lmaydigan bo'lsa, butun ilova o'chib
      qolardi. Xatoni loglaymiz va davom etamiz.
    */
    console.error("[fon] ishga tushishdagi tozalash bajarilmadi:", error);
  }
}
