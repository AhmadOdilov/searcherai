import "server-only";
import { getEnv } from "@/lib/env";
import { localStorageDriver } from "@/lib/storage/local";
import { createS3Driver } from "@/lib/storage/s3";
import type { FileKind, StorageDriver, StoredFile } from "@/lib/storage/types";

/**
 * Fayl saqlagichining YAGONA kirish nuqtasi.
 *
 * Yuqori qatlam (prezentatsiya, kalendar reja) faqat shu uch funksiyani
 * chaqiradi va qaysi drayver ishlatilayotganini BILMAYDI. Drayver
 * `.env` dagi `STORAGE_DRIVER` orqali tanlanadi:
 *
 *   local → disk (`storage/` papka) — VPS, Docker
 *   s3    → S3-mos xizmat — Vercel va boshqa serverless muhitlar
 *
 * Shartnoma va yordamchilar `lib/storage/types.ts` da.
 */

export { contentDispositionFor, mimeTypeFor } from "@/lib/storage/types";
export type { FileKind, StoredFile } from "@/lib/storage/types";

let cachedDriver: StorageDriver | null = null;
let cachedFingerprint = "";

/**
 * Joriy drayverni qaytaradi.
 *
 * Sozlama o'zgarsa qayta quriladi — sinovlar `process.env` ni import'dan
 * keyin o'zgartiradi va eski drayver qolib ketmasligi kerak.
 */
function driver(): StorageDriver {
  const env = getEnv();

  const fingerprint = JSON.stringify([
    env.STORAGE_DRIVER,
    env.S3_BUCKET,
    env.S3_ENDPOINT,
    env.S3_ACCESS_KEY,
    env.S3_REGION,
  ]);

  if (cachedDriver && fingerprint === cachedFingerprint) return cachedDriver;

  cachedDriver =
    env.STORAGE_DRIVER === "s3"
      ? createS3Driver({
          bucket: env.S3_BUCKET,
          endpoint: env.S3_ENDPOINT,
          accessKey: env.S3_ACCESS_KEY,
          secretKey: env.S3_SECRET_KEY,
          region: env.S3_REGION,
        })
      : localStorageDriver;

  cachedFingerprint = fingerprint;
  return cachedDriver;
}

/** Diagnostika uchun — `/api/health` ko'rsatadi. */
export function storageDriverName(): "local" | "s3" {
  return driver().name;
}

/** Faylni saqlaydi va bazaga yoziladigan yo'lni qaytaradi. */
export async function saveFile(
  kind: FileKind,
  recordId: string,
  buffer: Buffer,
): Promise<StoredFile> {
  return driver().saveFile(kind, recordId, buffer);
}

/** Faylni o'qiydi. Topilmasa `null`. */
export async function getFile(kind: FileKind, filePath: string): Promise<Buffer | null> {
  return driver().getFile(kind, filePath);
}

/** Faylni o'chiradi. Fayl yo'q bo'lsa xato bermaydi. */
export async function deleteFile(kind: FileKind, filePath: string): Promise<void> {
  return driver().deleteFile(kind, filePath);
}
