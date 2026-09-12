import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import {
  FILE_KINDS,
  fileNameFor,
  mimeTypeFor,
  type FileKind,
  type StorageDriver,
  type StoredFile,
} from "@/lib/storage/types";

/**
 * S3-mos saqlagich — serverless (Vercel) va kengaytirish uchun.
 *
 * ── Nega bitta drayver uch xizmatga yetadi ────────────────────────────────
 * Cloudflare R2, AWS S3 va MinIO — uchalasi ham AYNI S3 API'sini
 * qo'llab-quvvatlaydi. Farq faqat `S3_ENDPOINT` da:
 *
 *   AWS S3     → endpoint bo'sh (SDK region bo'yicha o'zi topadi)
 *   Cloudflare → https://<account-id>.r2.cloudflarestorage.com
 *   MinIO      → http://localhost:9000
 *
 * Shuning uchun alohida drayver yozish shart emas.
 */

/** S3 sozlamalari — `lib/env.ts` dan keladi. */
export interface S3Config {
  bucket: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

/**
 * Obyekt kaliti (S3 dagi "yo'l").
 *
 * Bazaga faqat FAYL NOMI yoziladi (local drayver bilan bir xil), papka
 * esa har chaqiruvda qo'shiladi. Shu tufayli ikki drayver o'rtasida
 * almashganda eski yozuvlar ishlashda davom etadi.
 */
function objectKey(kind: FileKind, filePath: string): string {
  return `${FILE_KINDS[kind].directory}/${filePath}`;
}

let cachedClient: S3Client | null = null;
let cachedFingerprint = "";

function client(config: S3Config): S3Client {
  const fingerprint = JSON.stringify(config);
  if (cachedClient && fingerprint === cachedFingerprint) return cachedClient;

  const options: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  };

  if (config.endpoint !== "") {
    options.endpoint = config.endpoint;
    /*
      Yo'l uslubidagi manzil (path-style).

      AWS S3 `https://<bucket>.s3.../key` ko'rinishini ishlatadi, R2 va
      MinIO esa `https://endpoint/<bucket>/key` ni kutadi. Maxsus endpoint
      berilganda ikkinchi uslub xavfsizroq — aks holda so'rov noto'g'ri
      domenga ketadi.
    */
    options.forcePathStyle = true;
  }

  cachedClient = new S3Client(options);
  cachedFingerprint = fingerprint;
  return cachedClient;
}

/** Sinovlar uchun: keshlangan klientni tozalaydi. */
export function resetS3Client(): void {
  cachedClient = null;
  cachedFingerprint = "";
}

export function createS3Driver(config: S3Config): StorageDriver {
  return {
    name: "s3",

    async saveFile(
      kind: FileKind,
      recordId: string,
      buffer: Buffer,
    ): Promise<StoredFile> {
      const filePath = fileNameFor(kind, recordId);

      await client(config).send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey(kind, filePath),
          Body: buffer,
          ContentType: mimeTypeFor(kind),
        }),
      );

      return { filePath, fileSize: buffer.length };
    },

    async getFile(kind: FileKind, filePath: string): Promise<Buffer | null> {
      try {
        const response = await client(config).send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: objectKey(kind, filePath),
          }),
        );

        if (!response.Body) return null;

        // `transformToByteArray()` — SDK v3 ning oqimni to'liq o'qish usuli.
        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
      } catch (error) {
        // Fayl yo'q — bu XATO EMAS, `null` qaytaramiz (shartnomaga ko'ra).
        if (isNotFound(error)) return null;

        console.error(`[storage:s3] ${filePath} o'qib bo'lmadi:`, error);
        return null;
      }
    },

    async deleteFile(kind: FileKind, filePath: string): Promise<void> {
      try {
        await client(config).send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: objectKey(kind, filePath),
          }),
        );
      } catch (error) {
        // O'chirish muvaffaqiyatsiz bo'lsa ham chaqiruvchi to'xtamasligi
        // kerak — yozuv baribir o'chadi, fayl esa keyinroq tozalanadi.
        if (!isNotFound(error)) {
          console.error(`[storage:s3] ${filePath} o'chirilmadi:`, error);
        }
      }
    },
  };
}

/** S3 "topilmadi" xatosini aniqlaydi (xizmatlar turlicha nomlaydi). */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const named = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    named.name === "NoSuchKey" ||
    named.name === "NotFound" ||
    named.$metadata?.httpStatusCode === 404
  );
}
