import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FILE_KINDS,
  fileNameFor,
  type FileKind,
  type StorageDriver,
  type StoredFile,
} from "@/lib/storage/types";

/**
 * Diskdagi saqlagich — VPS va Docker uchun.
 *
 * ── Nega `public/` EMAS ───────────────────────────────────────────────────
 * `public/` ichidagi hamma narsani Next.js STATIK tarqatadi: havolani
 * bilgan har qanday odam, hatto tizimga kirmagan bo'lsa ham, faylni
 * olardi — ya'ni yuklab olish route'laridagi egalik tekshiruvi bekor
 * bo'lardi.
 *
 * Shuning uchun fayllar `storage/<tur>/` da va faqat autentifikatsiyadan
 * o'tgan route orqali beriladi.
 *
 * ── Cheklov ───────────────────────────────────────────────────────────────
 * Serverless muhitda (Vercel) fayl tizimi faqat o'qish uchun ochiq —
 * bu drayver u yerda ISHLAMAYDI. Unday holatda `STORAGE_DRIVER=s3`.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage");

function rootFor(kind: FileKind): string {
  return path.join(STORAGE_ROOT, FILE_KINDS[kind].directory);
}

/**
 * Yo'lni saqlagich ichida ekanini tekshiradi.
 *
 * Bazadagi qiymat kutilmaganda `../../.env` kabi bo'lib qolsa, bu
 * funksiya uni rad etadi — saqlagichdan tashqaridagi fayl hech qachon
 * o'qilmaydi yoki o'chirilmaydi.
 */
function resolveInsideStorage(kind: FileKind, filePath: string): string | null {
  const root = path.resolve(rootFor(kind));
  const resolved = path.resolve(root, filePath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    console.error(
      `[storage:local] saqlagichdan tashqaridagi yo'l rad etildi: ${filePath}`,
    );
    return null;
  }
  return resolved;
}

export const localStorageDriver: StorageDriver = {
  name: "local",

  async saveFile(kind: FileKind, recordId: string, buffer: Buffer): Promise<StoredFile> {
    const root = rootFor(kind);
    await mkdir(root, { recursive: true });

    const fileName = fileNameFor(kind, recordId);
    await writeFile(path.join(root, fileName), buffer);

    return { filePath: fileName, fileSize: buffer.length };
  },

  async getFile(kind: FileKind, filePath: string): Promise<Buffer | null> {
    const resolved = resolveInsideStorage(kind, filePath);
    if (resolved === null) return null;

    try {
      return await readFile(resolved);
    } catch {
      return null;
    }
  },

  async deleteFile(kind: FileKind, filePath: string): Promise<void> {
    const resolved = resolveInsideStorage(kind, filePath);
    if (resolved === null) return;

    await unlink(resolved).catch(() => undefined);
  },
};
