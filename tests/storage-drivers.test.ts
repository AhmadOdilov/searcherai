import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  contentDispositionFor,
  fileNameFor,
  mimeTypeFor,
  type FileKind,
  type StorageDriver,
} from "../lib/storage/types";

/**
 * Saqlagich drayverlari sinovlari.
 *
 * ── Ikki drayver, BIR XIL shartnoma ───────────────────────────────────────
 * `local` va `s3` bir xil `StorageDriver` interfeysini bajaradi. Shuning
 * uchun asosiy sinovlar IKKALASIGA ham qo'llaniladi — agar biri ikkinchisidan
 * boshqacha ishlasa, drayver almashtirilganda ilova jim buzilardi.
 *
 * S3 uchun haqiqiy xizmat kerak emas: `@aws-sdk/client-s3` ning `send()`
 * metodi mock qilinadi va xotiradagi "bucket" bilan ishlaydi.
 */

const KIND: FileKind = "pptx";

// ─── Soxta S3 ────────────────────────────────────────────────────────────────

/**
 * Xotiradagi S3.
 *
 * Haqiqiy SDK'ning `send()` chaqiruvini ushlab, buyruq turiga qarab
 * xotiradagi `Map` bilan ishlaydi. Bu bizga kerakli narsani beradi:
 * drayver TO'G'RI buyruqlarni TO'G'RI parametrlar bilan yuboryaptimi.
 */
function createMockS3(): {
  objects: Map<string, Buffer>;
  commands: Array<{ type: string; key: string; bucket: string }>;
  send: (command: unknown) => Promise<unknown>;
} {
  const objects = new Map<string, Buffer>();
  const commands: Array<{ type: string; key: string; bucket: string }> = [];

  const send = async (command: unknown): Promise<unknown> => {
    const input = (command as { input: Record<string, unknown> }).input;
    const type = (command as { constructor: { name: string } }).constructor.name;
    const key = String(input.Key);
    const bucket = String(input.Bucket);

    commands.push({ type, key, bucket });

    if (type === "PutObjectCommand") {
      objects.set(key, Buffer.from(input.Body as Buffer));
      return {};
    }

    if (type === "GetObjectCommand") {
      const stored = objects.get(key);
      if (!stored) {
        const error = new Error("NoSuchKey") as Error & { name: string };
        error.name = "NoSuchKey";
        throw error;
      }
      return {
        Body: {
          transformToByteArray: async () => new Uint8Array(stored),
        },
      };
    }

    if (type === "DeleteObjectCommand") {
      objects.delete(key);
      return {};
    }

    throw new Error(`kutilmagan buyruq: ${type}`);
  };

  return { objects, commands, send };
}

/** S3 drayverini soxta klient bilan quradi. */
async function buildS3Driver(mock: ReturnType<typeof createMockS3>) {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const { createS3Driver, resetS3Client } = await import("../lib/storage/s3");

  resetS3Client();

  // SDK klientining `send` metodini almashtiramiz — tarmoqqa chiqmasin.
  const original = S3Client.prototype.send;
  (S3Client.prototype as unknown as { send: unknown }).send = mock.send;

  const driver = createS3Driver({
    bucket: "sinov-bucket",
    endpoint: "https://example.r2.cloudflarestorage.com",
    accessKey: "kalit",
    secretKey: "sir",
    region: "auto",
  });

  return {
    driver,
    restore: () => {
      (S3Client.prototype as unknown as { send: unknown }).send = original;
      resetS3Client();
    },
  };
}

// ─── Umumiy shartnoma sinovlari ──────────────────────────────────────────────

/**
 * Har ikki drayver uchun bajariladigan sinovlar.
 *
 * `build` — drayverni va tozalash funksiyasini qaytaradi.
 */
function describeDriverContract(
  name: string,
  build: () => Promise<{ driver: StorageDriver; cleanup: () => Promise<void> }>,
) {
  describe(`${name} drayveri — shartnoma`, () => {
    let cleanup: (() => Promise<void>) | null = null;

    afterEach(async () => {
      await cleanup?.();
      cleanup = null;
    });

    it("saqlaydi va AYNAN o'sha buferni qaytaradi", async () => {
      const built = await build();
      cleanup = built.cleanup;

      const content = Buffer.from("PK\x03\x04 sinov mazmuni: oʻ gʻ ʻ");
      const saved = await built.driver.saveFile(KIND, "yozuv-1", content);

      assert.equal(saved.fileSize, content.length);
      assert.equal(saved.filePath, "yozuv-1.pptx");

      const read = await built.driver.getFile(KIND, saved.filePath);
      assert.ok(read !== null, "fayl o'qilishi kerak");
      assert.ok(read.equals(content), "bufer AYNAN bir xil bo'lishi kerak");
    });

    it("IKKILIK (binary) ma'lumotni buzmaydi", async () => {
      const built = await build();
      cleanup = built.cleanup;

      // 0-255 oralig'idagi barcha baytlar — matnga aylantirilsa buziladi.
      const content = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
      const saved = await built.driver.saveFile(KIND, "ikkilik", content);

      const read = await built.driver.getFile(KIND, saved.filePath);
      assert.ok(read !== null);
      assert.equal(read.length, 256);
      assert.ok(read.equals(content));
    });

    it("mavjud bo'lmagan fayl uchun null qaytaradi, XATO TASHLAMAYDI", async () => {
      const built = await build();
      cleanup = built.cleanup;

      const read = await built.driver.getFile(KIND, "umuman-yoq.pptx");
      assert.equal(read, null);
    });

    it("o'chiradi va keyin null qaytaradi", async () => {
      const built = await build();
      cleanup = built.cleanup;

      const saved = await built.driver.saveFile(
        KIND,
        "ochiriladi",
        Buffer.from("mazmun"),
      );
      assert.ok((await built.driver.getFile(KIND, saved.filePath)) !== null);

      await built.driver.deleteFile(KIND, saved.filePath);
      assert.equal(await built.driver.getFile(KIND, saved.filePath), null);
    });

    it("mavjud bo'lmagan faylni o'chirish XATO BERMAYDI", async () => {
      const built = await build();
      cleanup = built.cleanup;

      // Idempotent bo'lishi kerak — chaqiruvchi yozuvni baribir o'chiradi.
      await built.driver.deleteFile(KIND, "umuman-yoq.pptx");
    });

    it("bir nechta faylni ajratib saqlaydi", async () => {
      const built = await build();
      cleanup = built.cleanup;

      await built.driver.saveFile(KIND, "birinchi", Buffer.from("A"));
      await built.driver.saveFile(KIND, "ikkinchi", Buffer.from("B"));

      const first = await built.driver.getFile(KIND, "birinchi.pptx");
      const second = await built.driver.getFile(KIND, "ikkinchi.pptx");

      assert.equal(first!.toString(), "A");
      assert.equal(second!.toString(), "B");
    });

    it("xlsx va pptx turlarini ARALASHTIRMAYDI", async () => {
      const built = await build();
      cleanup = built.cleanup;

      await built.driver.saveFile("pptx", "bir-xil-id", Buffer.from("pptx"));
      await built.driver.saveFile("xlsx", "bir-xil-id", Buffer.from("xlsx"));

      const pptx = await built.driver.getFile("pptx", "bir-xil-id.pptx");
      const xlsx = await built.driver.getFile("xlsx", "bir-xil-id.xlsx");

      assert.equal(pptx!.toString(), "pptx");
      assert.equal(xlsx!.toString(), "xlsx");
    });
  });
}

// ─── local drayveri ──────────────────────────────────────────────────────────

describeDriverContract("local", async () => {
  // Vaqtinchalik papkada ishlaymiz — loyihaning `storage/` siga tegmaymiz.
  const tempRoot = await mkdtemp(path.join(tmpdir(), "searcher-storage-"));
  const originalCwd = process.cwd();
  process.chdir(tempRoot);

  const { localStorageDriver } = await import("../lib/storage/local");

  return {
    driver: localStorageDriver,
    cleanup: async () => {
      process.chdir(originalCwd);
      await rm(tempRoot, { recursive: true, force: true });
    },
  };
});

describe("local drayveri — xavfsizlik", () => {
  it("saqlagichdan TASHQARIDAGI yo'lni rad etadi", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "searcher-storage-"));
    const originalCwd = process.cwd();
    process.chdir(tempRoot);

    try {
      const { localStorageDriver } = await import("../lib/storage/local");

      // Bazadagi qiymat buzilgan bo'lsa ham tashqaridagi fayl o'qilmasligi
      // kerak.
      const read = await localStorageDriver.getFile(KIND, "../../../etc/passwd");
      assert.equal(read, null);

      // O'chirish ham xavfsiz bo'lishi kerak.
      await localStorageDriver.deleteFile(KIND, "../../../etc/passwd");
    } finally {
      process.chdir(originalCwd);
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

// ─── s3 drayveri ─────────────────────────────────────────────────────────────

describeDriverContract("s3", async () => {
  const mock = createMockS3();
  const built = await buildS3Driver(mock);

  return {
    driver: built.driver,
    cleanup: async () => built.restore(),
  };
});

describe("s3 drayveri — obyekt kalitlari", () => {
  it("papkani kalitga qo'shadi, bazaga esa FAQAT fayl nomi yoziladi", async () => {
    // Bu muhim: bazadagi qiymat ikki drayverda bir xil bo'lishi kerak,
    // aks holda drayver almashtirilganda eski yozuvlar buzilardi.
    const mock = createMockS3();
    const built = await buildS3Driver(mock);

    try {
      const saved = await built.driver.saveFile("pptx", "yozuv-1", Buffer.from("x"));

      // Bazaga — faqat fayl nomi (local bilan bir xil)
      assert.equal(saved.filePath, "yozuv-1.pptx");
      // S3'ga — papka bilan
      assert.equal(mock.commands[0].key, "presentations/yozuv-1.pptx");
      assert.equal(mock.commands[0].bucket, "sinov-bucket");
    } finally {
      built.restore();
    }
  });

  it("xlsx uchun boshqa papka ishlatadi", async () => {
    const mock = createMockS3();
    const built = await buildS3Driver(mock);

    try {
      await built.driver.saveFile("xlsx", "reja-1", Buffer.from("x"));
      assert.equal(mock.commands[0].key, "calendar-plans/reja-1.xlsx");
    } finally {
      built.restore();
    }
  });

  it("to'g'ri buyruqlarni yuboradi", async () => {
    const mock = createMockS3();
    const built = await buildS3Driver(mock);

    try {
      await built.driver.saveFile(KIND, "a", Buffer.from("x"));
      await built.driver.getFile(KIND, "a.pptx");
      await built.driver.deleteFile(KIND, "a.pptx");

      assert.deepEqual(
        mock.commands.map((command) => command.type),
        ["PutObjectCommand", "GetObjectCommand", "DeleteObjectCommand"],
      );
    } finally {
      built.restore();
    }
  });
});

// ─── Drayverdan mustaqil yordamchilar ────────────────────────────────────────

describe("saqlagich yordamchilari", () => {
  it("MIME turlari to'g'ri", () => {
    assert.match(mimeTypeFor("pptx"), /presentationml\.presentation$/);
    assert.match(mimeTypeFor("xlsx"), /spreadsheetml\.sheet$/);
  });

  it("fayl nomi kengaytmasi tur bo'yicha", () => {
    assert.equal(fileNameFor("pptx", "abc"), "abc.pptx");
    assert.equal(fileNameFor("xlsx", "abc"), "abc.xlsx");
  });

  it("Content-Disposition ikki shaklda beradi", () => {
    const header = contentDispositionFor("Oʻzbek tili — 7-sinf", "xlsx");

    assert.match(header, /^attachment;/);
    assert.match(header, /filename="[\x20-\x7E]+\.xlsx"/, "ASCII nom");
    assert.match(header, /filename\*=UTF-8''/, "UTF-8 nom");
  });

  it("bo'sh sarlavhada ham yaroqli nom beradi", () => {
    const header = contentDispositionFor("   ", "pptx");
    assert.match(header, /filename="[^"]+\.pptx"/);
  });

  it("faqat ASCII bo'lmagan sarlavhada zaxira nom ishlatadi", () => {
    // "Презентация" dan ASCII qolmaydi — nom bo'sh bo'lib qolmasligi kerak.
    const header = contentDispositionFor("Презентация", "pptx");
    assert.match(header, /filename="document\.pptx"/);
  });
});
