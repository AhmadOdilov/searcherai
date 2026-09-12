import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Generatsiya qilingan fayllar saqlagichi.
 *
 * ── Nega `public/` EMAS ───────────────────────────────────────────────────
 * `public/` ichidagi hamma narsani Next.js STATIK tarqatadi: havolani bilgan
 * har qanday odam, hatto tizimga kirmagan bo'lsa ham, faylni oladi. Ya'ni
 * `GET /api/presentations/[id]/download` dagi egalik tekshiruvi bekor
 * bo'lardi — bir o'qituvchi boshqasining prezentatsiyasini yuklab olardi.
 *
 * Shuning uchun fayllar `storage/presentations/` da — public'dan tashqarida.
 * Yagona yo'l — autentifikatsiyadan o'tgan download route.
 *
 * Ikkinchi sabab: productionda (Vercel kabi) fayl tizimi faqat o'qish uchun
 * ochiq bo'ladi va build paytida yozilgan `public/` o'zgarmaydi. Bu qatlam
 * alohida bo'lsa, keyinchalik S3/R2 ga o'tish faqat shu faylni o'zgartirishni
 * talab qiladi.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "presentations");

/** .pptx faylining MIME turi. */
export const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/**
 * Faylni saqlaydi va BAZAGA YOZILADIGAN nisbiy yo'lni qaytaradi.
 *
 * Bazada absolyut yo'l saqlanmaydi: loyiha boshqa papkaga ko'chsa yoki
 * productionda boshqa yo'lda ishlasa, eski yozuvlar buzilmasin.
 */
export async function savePresentationFile(
  presentationId: string,
  buffer: Buffer,
): Promise<{ filePath: string; fileSize: number }> {
  await mkdir(STORAGE_ROOT, { recursive: true });

  const fileName = `${presentationId}.pptx`;
  await writeFile(path.join(STORAGE_ROOT, fileName), buffer);

  return { filePath: fileName, fileSize: buffer.length };
}

/**
 * Saqlangan faylni o'qiydi.
 *
 * Fayl topilmasa `null` — yozuv bazada bor, lekin fayl o'chib ketgan
 * bo'lishi mumkin (masalan disk tozalangan). Bunda foydalanuvchiga
 * "qaytadan yaratish" taklif qilinadi.
 */
export async function readPresentationFile(filePath: string): Promise<Buffer | null> {
  const resolved = resolveInsideStorage(filePath);
  if (resolved === null) return null;

  try {
    return await readFile(resolved);
  } catch {
    return null;
  }
}

/** Faylni o'chiradi. Fayl yo'q bo'lsa xato bermaydi. */
export async function deletePresentationFile(filePath: string): Promise<void> {
  const resolved = resolveInsideStorage(filePath);
  if (resolved === null) return;

  await unlink(resolved).catch(() => undefined);
}

/**
 * Yo'lni saqlagich ichida ekanini tekshiradi.
 *
 * Bazadagi qiymat kutilmaganda `../../.env` kabi bo'lib qolsa (masalan
 * kelgusida boshqa kod noto'g'ri yozsa), bu funksiya uni rad etadi —
 * saqlagichdan tashqaridagi fayl hech qachon o'qilmaydi yoki o'chirilmaydi.
 */
function resolveInsideStorage(filePath: string): string | null {
  const resolved = path.resolve(STORAGE_ROOT, filePath);
  const root = path.resolve(STORAGE_ROOT);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    console.error(
      `[storage] saqlagichdan tashqaridagi yo'lga murojaat rad etildi: ${filePath}`,
    );
    return null;
  }
  return resolved;
}

/**
 * Yuklab olish uchun fayl nomi.
 *
 * ASCII bo'lmagan belgilar (`oʻ`, `gʻ`, kirill) `Content-Disposition`
 * sarlavhasida muammo qiladi — shuning uchun ikki shakl beriladi:
 * `filename` (xavfsiz ASCII) va `filename*` (to'liq UTF-8). Brauzerlar
 * ikkinchisini afzal ko'radi, eski mijozlar birinchisiga tushadi.
 */
export function contentDispositionFor(title: string): string {
  const base = (title.trim() || "prezentatsiya").slice(0, 80);

  const asciiName = `${
    base
      .normalize("NFKD")
      // Diakritika va ASCII bo'lmagan belgilarni tashlaymiz.
      .replace(/[^\x20-\x7E]/g, "")
      // Fayl tizimi va sarlavha uchun xavfli belgilar.
      .replace(/["\\/:*?<>|]/g, "")
      .replace(/\s+/g, "_")
      .replace(/^[._]+|[._]+$/g, "")
      .slice(0, 60) || "presentation"
  }.pptx`;

  const utf8Name = encodeURIComponent(`${base}.pptx`);

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}
