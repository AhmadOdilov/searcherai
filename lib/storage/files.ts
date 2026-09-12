import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Generatsiya qilingan fayllar saqlagichi — barcha modullar uchun umumiy.
 *
 * ── Nega `public/` EMAS ───────────────────────────────────────────────────
 * `public/` ichidagi hamma narsani Next.js STATIK tarqatadi: havolani bilgan
 * har qanday odam, hatto tizimga kirmagan bo'lsa ham, faylni olardi. Ya'ni
 * yuklab olish route'laridagi egalik tekshiruvi bekor bo'lardi.
 *
 * Shuning uchun fayllar `storage/<tur>/` da — public'dan tashqarida. Yagona
 * yo'l — autentifikatsiyadan o'tgan download route.
 *
 * Ikkinchi sabab: productionda (Vercel kabi) fayl tizimi faqat o'qish uchun
 * ochiq bo'ladi. Bu qatlam alohida bo'lgani uchun S3/R2 ga o'tish faqat shu
 * faylni o'zgartirishni talab qiladi.
 */

/** Qo'llab-quvvatlanadigan fayl turlari. */
export const FILE_KINDS = {
  pptx: {
    directory: "presentations",
    extension: ".pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  xlsx: {
    directory: "calendar-plans",
    extension: ".xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
} as const;

export type FileKind = keyof typeof FILE_KINDS;

/** Fayl turining MIME turi — download route'lari shundan foydalanadi. */
export function mimeTypeFor(kind: FileKind): string {
  return FILE_KINDS[kind].mimeType;
}

function rootFor(kind: FileKind): string {
  return path.join(process.cwd(), "storage", FILE_KINDS[kind].directory);
}

/**
 * Faylni saqlaydi va BAZAGA YOZILADIGAN nisbiy yo'lni qaytaradi.
 *
 * Bazada absolyut yo'l saqlanmaydi: loyiha boshqa papkaga ko'chsa yoki
 * productionda boshqa yo'lda ishlasa, eski yozuvlar buzilmasin.
 */
export async function saveGeneratedFile(
  kind: FileKind,
  recordId: string,
  buffer: Buffer,
): Promise<{ filePath: string; fileSize: number }> {
  const root = rootFor(kind);
  await mkdir(root, { recursive: true });

  const fileName = `${recordId}${FILE_KINDS[kind].extension}`;
  await writeFile(path.join(root, fileName), buffer);

  return { filePath: fileName, fileSize: buffer.length };
}

/**
 * Saqlangan faylni o'qiydi.
 *
 * Fayl topilmasa `null` — yozuv bazada bor, lekin fayl o'chib ketgan
 * bo'lishi mumkin (masalan disk tozalangan). Bunda foydalanuvchiga
 * "qaytadan yaratish" taklif qilinadi.
 */
export async function readGeneratedFile(
  kind: FileKind,
  filePath: string,
): Promise<Buffer | null> {
  const resolved = resolveInsideStorage(kind, filePath);
  if (resolved === null) return null;

  try {
    return await readFile(resolved);
  } catch {
    return null;
  }
}

/** Faylni o'chiradi. Fayl yo'q bo'lsa xato bermaydi. */
export async function deleteGeneratedFile(
  kind: FileKind,
  filePath: string,
): Promise<void> {
  const resolved = resolveInsideStorage(kind, filePath);
  if (resolved === null) return;

  await unlink(resolved).catch(() => undefined);
}

/**
 * Yo'lni saqlagich ichida ekanini tekshiradi.
 *
 * Bazadagi qiymat kutilmaganda `../../.env` kabi bo'lib qolsa, bu funksiya
 * uni rad etadi — saqlagichdan tashqaridagi fayl hech qachon o'qilmaydi
 * yoki o'chirilmaydi.
 */
function resolveInsideStorage(kind: FileKind, filePath: string): string | null {
  const root = path.resolve(rootFor(kind));
  const resolved = path.resolve(root, filePath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    console.error(
      `[storage] saqlagichdan tashqaridagi yo'lga murojaat rad etildi: ${filePath}`,
    );
    return null;
  }
  return resolved;
}

/**
 * Yuklab olish uchun `Content-Disposition` sarlavhasi.
 *
 * ASCII bo'lmagan belgilar (`oʻ`, `gʻ`, kirill) bu sarlavhada muammo
 * qiladi — shuning uchun ikki shakl beriladi: `filename` (xavfsiz ASCII)
 * va `filename*` (to'liq UTF-8). Brauzerlar ikkinchisini afzal ko'radi,
 * eski mijozlar birinchisiga tushadi.
 */
export function contentDispositionFor(title: string, kind: FileKind): string {
  const extension = FILE_KINDS[kind].extension;
  const base = (title.trim() || "fayl").slice(0, 80);

  const asciiBase =
    base
      .normalize("NFKD")
      // Diakritika va ASCII bo'lmagan belgilarni tashlaymiz.
      .replace(/[^\x20-\x7E]/g, "")
      // Fayl tizimi va sarlavha uchun xavfli belgilar.
      .replace(/["\\/:*?<>|]/g, "")
      .replace(/\s+/g, "_")
      .replace(/^[._]+|[._]+$/g, "")
      .slice(0, 60) || "document";

  const asciiName = `${asciiBase}${extension}`;
  const utf8Name = encodeURIComponent(`${base}${extension}`);

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}
