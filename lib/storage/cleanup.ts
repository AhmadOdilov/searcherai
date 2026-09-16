import "server-only";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/storage/files";

/**
 * Foydalanuvchining BARCHA generatsiya fayllarini o'chiradi.
 *
 * ── Nega bu funksiya kerak ────────────────────────────────────────────────
 * Bazadagi `onDelete: Cascade` foydalanuvchi o'chirilganda uning
 * yozuvlarini ham o'chiradi — lekin u FAYL TIZIMINI BILMAYDI. Ya'ni
 * yozuv yo'qoladi, diskdagi .pptx va .xlsx esa abadiy qoladi va ularni
 * hech qachon topib bo'lmaydi (yo'l faqat yozuvda saqlanardi).
 *
 * Bu — hozircha LATENT muammo: ilovada foydalanuvchini o'chirish yo'li
 * umuman yo'q edi. "Hisobni o'chirish" qo'shilishi bilan u darhol
 * haqiqiy bo'ladi. Shuning uchun tozalash o'sha funksiyadan OLDIN
 * yozildi.
 *
 * ── Tartib MUHIM ──────────────────────────────────────────────────────────
 * Avval FAYL, keyin YOZUV. Teskarisida yozuv o'chib, fayl yo'li
 * yo'qoladi va fayl abadiy yetim qoladi. Bu tartibda esa eng yomon holat
 * — fayl o'chib, yozuv qolishi, va uni keyin ham tuzatish mumkin.
 *
 * ── Drayverdan mustaqil ───────────────────────────────────────────────────
 * `deleteFile()` local va S3 drayverlarining ikkalasida ham ishlaydi
 * (`lib/storage/files.ts`). Bu yerda drayver haqida hech narsa
 * bilinmaydi.
 */
export async function deleteAllUserFiles(userId: string): Promise<{
  pptx: number;
  xlsx: number;
}> {
  const [presentations, calendarPlans] = await Promise.all([
    prisma.presentation.findMany({
      where: { userId, filePath: { not: null } },
      select: { filePath: true },
    }),
    prisma.calendarPlan.findMany({
      where: { userId, filePath: { not: null } },
      select: { filePath: true },
    }),
  ]);

  /*
    Xatolar YUTILADI: bitta fayl o'chmagani butun hisobni o'chirishga
    to'sqinlik qilmasligi kerak. Foydalanuvchi "hisobimni o'chir" deb
    so'radi — uni "bitta fayl o'chmadi" degan sabab bilan to'xtatish
    noto'g'ri bo'lardi. Xato `deleteFile` ichida loglanadi.
  */
  await Promise.all([
    ...presentations.map((row) => deleteFile("pptx", row.filePath!)),
    ...calendarPlans.map((row) => deleteFile("xlsx", row.filePath!)),
  ]);

  return { pptx: presentations.length, xlsx: calendarPlans.length };
}
