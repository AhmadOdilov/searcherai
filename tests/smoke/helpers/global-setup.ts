import { readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { startMockAiServer, type MockAiServer } from "../../e2e/helpers/mock-ai.ts";
import {
  CONTAINER_NAME,
  SMOKE_BASE_URL,
  SMOKE_PORT,
  STANDALONE_DIR,
  appEnv,
  buildImage,
  dockerQuiet,
  runContainer,
  spawnStandalone,
  stageStandalone,
  targetKind,
  waitForHealth,
  wipeStandaloneStorage,
} from "./target.ts";

/**
 * Production artefaktini ko'taradi — smoke to'plamining yagona kirish nuqtasi.
 *
 * `node --test-global-setup` buni bir marta chaqiradi, sinov fayllari esa
 * alohida jarayonlarda ishlaydi. Ular bilan bog'lanish MUHIT
 * O'ZGARUVCHILARI orqali — `tests/e2e/helpers/global-server.ts` dagi
 * bilan bir xil naqsh.
 */

let server: ChildProcess | null = null;
let mockAi: MockAiServer | null = null;

/**
 * Paketning TOZA holatidagi fayllar ro'yxati.
 *
 * Nega surat olinadi: `stageStandalone()` paketga `public/`, `.next/static`
 * va bo'sh `storage/` qo'shadi — ular Dockerfile'da ham qo'shiladi va
 * qonuniy. Lekin "paketda ortiqcha narsa yo'q" tekshiruvi build NIMA
 * chiqarganiga qarashi kerak, biz keyin nima qo'shganimizga emas.
 * Shuning uchun ro'yxat staging'dan OLDIN olinadi.
 *
 * `node_modules` chetlab o'tiladi: u bog'liqliklarning o'z fayllari va
 * tekshiruv mavzusi emas (tekshirilayotgani — LOYIHANING o'z fayllari
 * paketga qanday tushgani).
 */
async function snapshotBundle(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(directory: string, prefix: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path.join(directory, entry.name), relative);
      } else {
        found.push(relative);
      }
    }
  }

  await walk(root, "");
  return found;
}

export async function globalSetup(): Promise<void> {
  const kind = targetKind();

  /*
    Soxta AI serveri ilovadan OLDIN ko'tariladi: uning manzili muhit
    o'zgaruvchisi bilan beriladi, ya'ni jarayon boshlangach o'zgartirib
    bo'lmaydi.

    Docker holatida u BARCHA interfeyslarda tinglashi kerak — konteyner
    uchun `127.0.0.1` uning o'z ichi.
  */
  mockAi = await startMockAiServer(kind === "docker" ? { host: "0.0.0.0" } : {});
  const aiBaseUrl = mockAi.baseUrl;

  const env = appEnv(aiBaseUrl);

  if (kind === "docker") {
    await buildImage();
    await dockerQuiet(["rm", "-f", CONTAINER_NAME]);
    await runContainer(CONTAINER_NAME, SMOKE_PORT, env);
  } else {
    const snapshot = await snapshotBundle(STANDALONE_DIR);
    const snapshotPath = path.join(tmpdir(), `searcher-smoke-bundle-${process.pid}.json`);
    await writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");
    process.env.SMOKE_BUNDLE_SNAPSHOT = snapshotPath;

    await stageStandalone();
    server = spawnStandalone(SMOKE_PORT, env);
    server.on("error", (error) => {
      console.error("standalone serverni ishga tushirib bo'lmadi:", error);
    });
  }

  await waitForHealth(SMOKE_BASE_URL);

  /*
    Sinov fayllari uchun sozlama.

    `E2E_BASE_URL` — ATAYLAB o'sha nom: `tests/e2e/helpers/client.ts`
    dagi `TestClient` shuni o'qiydi va o'zgartirishsiz qayta
    ishlatiladi.
  */
  process.env.E2E_BASE_URL = SMOKE_BASE_URL;
  process.env.SMOKE_BASE_URL = SMOKE_BASE_URL;
  process.env.SMOKE_TARGET = kind;
  process.env.SMOKE_AI_BASE_URL = aiBaseUrl;
}

export async function globalTeardown(): Promise<void> {
  if (targetKind() === "docker") {
    await dockerQuiet(["rm", "-f", CONTAINER_NAME]);
    await dockerQuiet(["rm", "-f", `${CONTAINER_NAME}-2`]);
  } else if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        server?.kill("SIGKILL");
        resolve();
      }, 5_000);
      server?.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    // Sinov yaratgan .pptx/.xlsx fayllar paketda qolib ketmasin.
    await wipeStandaloneStorage();
  }

  server = null;
  await mockAi?.close().catch(() => undefined);
  mockAi = null;
}
