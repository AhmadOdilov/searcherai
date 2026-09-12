/**
 * Fayl saqlagichining SHARTNOMASI.
 *
 * ── Nega abstraktsiya ─────────────────────────────────────────────────────
 * Deploy maqsadi hali aniq emas:
 *  · VPS / Docker — disk mavjud, oddiy fayl yozish ishlaydi
 *  · Vercel / serverless — fayl tizimi FAQAT O'QISH uchun, disk ishlamaydi
 *
 * Yuqori qatlam (prezentatsiya, kalendar reja) qaysi muhitda ishlayotganini
 * BILMASLIGI kerak. Shuning uchun u faqat shu shartnomaga murojaat qiladi,
 * haqiqiy implementatsiya esa `STORAGE_DRIVER` orqali tanlanadi.
 *
 * Bu fayl hech narsaga bog'lanmagan — sinovlar uni erkin import qiladi.
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

/** Saqlangan faylning bazaga yoziladigan ma'lumoti. */
export interface StoredFile {
  /**
   * Saqlagichdagi yo'l — bazadagi `filePath` ustuniga yoziladi.
   *
   * Absolyut yo'l EMAS: loyiha boshqa papkaga ko'chsa yoki driver
   * almashsa, eski yozuvlar buzilmasin.
   */
  filePath: string;
  fileSize: number;
}

/**
 * Saqlagich drayveri.
 *
 * Uchta amal yetarli — yuqori qatlam boshqa hech narsa qilmaydi.
 */
export interface StorageDriver {
  /** Drayver nomi — diagnostika va `/api/health` uchun. */
  readonly name: "local" | "s3";

  /** Faylni saqlaydi va bazaga yoziladigan yo'lni qaytaradi. */
  saveFile(kind: FileKind, recordId: string, buffer: Buffer): Promise<StoredFile>;

  /**
   * Faylni o'qiydi. Topilmasa `null`.
   *
   * Nega xato tashlamaydi: yozuv bazada bor, lekin fayl yo'q bo'lishi
   * mumkin (saqlagich tozalangan, drayver almashtirilgan). Bunday holatda
   * foydalanuvchiga "qaytadan yaratib ko'ring" deyish kerak, 500 emas.
   */
  getFile(kind: FileKind, filePath: string): Promise<Buffer | null>;

  /** Faylni o'chiradi. Fayl yo'q bo'lsa xato bermaydi. */
  deleteFile(kind: FileKind, filePath: string): Promise<void>;
}

/** Fayl turining MIME turi — download route'lari shundan foydalanadi. */
export function mimeTypeFor(kind: FileKind): string {
  return FILE_KINDS[kind].mimeType;
}

/**
 * Yuklab olish uchun `Content-Disposition` sarlavhasi.
 *
 * ASCII bo'lmagan belgilar (`oʻ`, `gʻ`, kirill) bu sarlavhada muammo
 * qiladi — shuning uchun ikki shakl beriladi: `filename` (xavfsiz ASCII)
 * va `filename*` (to'liq UTF-8). Brauzerlar ikkinchisini afzal ko'radi,
 * eski mijozlar birinchisiga tushadi.
 *
 * Drayverdan MUSTAQIL — fayl qayerda saqlanganidan qat'i nazar bir xil.
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

  return (
    `attachment; filename="${asciiBase}${extension}"; ` +
    `filename*=UTF-8''${encodeURIComponent(`${base}${extension}`)}`
  );
}

/** Yozuv identifikatoridan fayl nomi. */
export function fileNameFor(kind: FileKind, recordId: string): string {
  return `${recordId}${FILE_KINDS[kind].extension}`;
}
