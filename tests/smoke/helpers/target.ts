import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Production smoke testining NISHONI — sinaladigan haqiqiy artefakt.
 *
 * ── Nega bu qatlam kerak ──────────────────────────────────────────────────
 * Mavjud `tests/e2e` to'plami `next dev` ga qarshi ishlaydi
 * (`tests/e2e/helpers/global-server.ts`). Dev serveri esa aynan
 * production'da buziladigan narsalarni YASHIRADI:
 *
 *  · `NODE_ENV=production` — cookie'ning `Secure` bayrog'i faqat o'shanda;
 *  · CSP — dev'da `'unsafe-eval'` va `'unsafe-inline'` ataylab ochiq;
 *  · `output: "standalone"` — fayllarni nusxalash faqat build'da bo'ladi;
 *  · saqlagich ildizi — standalone serverning `process.cwd()` i boshqa.
 *
 * Phase 5 va Phase 6 dagi ikkala artefakt darajasidagi nuqson
 * (`storage/` va `.env` ning deploy paketiga tushishi) 826 ta yashil
 * testdan o'tib ketgan edi — ularning birortasi ham HAQIQIY paketni
 * ko'rmasdi.
 *
 * ── Ikki nishon, BITTA to'plam ────────────────────────────────────────────
 * `tests/smoke/shared/` dagi sinovlar nishonni bilmaydi: ular faqat
 * `BASE_URL` bilan ishlaydi. Shu tufayli AYNAN o'sha sinovlar ikkala
 * yo'lda ham bajariladi:
 *
 *   standalone — `next build` natijasi, `node server.js` bilan;
 *   docker     — `Dockerfile` dan yig'ilgan haqiqiy image.
 *
 * Nishonga xos tekshiruvlar esa alohida fayllarda
 * (`standalone.smoke.ts`, `docker.smoke.ts`), shuning uchun `.skip`
 * kerak emas.
 *
 * ── Nega sozlama muhit o'zgaruvchilari orqali uzatiladi ───────────────────
 * Node test runner'i har bir sinov faylini ALOHIDA jarayonda ishga
 * tushiradi, `--test-global-setup` esa asosiy jarayonda bajariladi.
 * Ya'ni sinov fayli bu yerdagi obyektga tega olmaydi. Mavjud e2e
 * qatlami ham xuddi shu muammoni shu yo'l bilan hal qiladi
 * (`process.env.E2E_BASE_URL`), shuning uchun naqsh takrorlanadi.
 */

export type TargetKind = "standalone" | "docker";

/** Smoke serverining porti — e2e (3100) va Playwright (3200) bilan to'qnashmaydi. */
export const SMOKE_PORT = 3300;
export const SMOKE_BASE_URL = `http://127.0.0.1:${SMOKE_PORT}`;

/**
 * Ikkinchi darajali nusxa uchun port.
 *
 * Nega kerak: `instrumentation.ts` dagi `register()` faqat server ISHGA
 * TUSHGANDA bajariladi. Uni sinash uchun serverni qayta ishga tushirish
 * kerak, lekin ASOSIY nishonni qayta ishga tushirish boshqa sinovlarga
 * xalaqit berardi. Shuning uchun qisqa umrli ikkinchi nusxa ko'tariladi:
 * u o'sha bazaga ulanadi, `register()` ni bajaradi va o'chadi.
 */
export const SECONDARY_PORT = 3301;

export const CONTAINER_NAME = "searcher-ai-smoke";
export const IMAGE_TAG = "searcher-ai:smoke";

const REPO_ROOT = process.cwd();
export const STANDALONE_DIR = path.join(REPO_ROOT, ".next", "standalone");

/**
 * Konteyner ichidan XOST mashinasiga murojaat qilish uchun nom.
 *
 * Konteyner uchun `localhost` — uning O'Z ichi. Postgres va soxta AI
 * serveri esa xostda turadi. `--add-host=...:host-gateway` Linux'da
 * (CI) shu nomni yaratadi; macOS'da Docker Desktop uni allaqachon
 * beradi va bayroq zararsiz qoladi.
 */
const DOCKER_HOST_ALIAS = "host.docker.internal";

function toContainerReachable(url: string): string {
  return url.replace(/(?:localhost|127\.0\.0\.1)/g, DOCKER_HOST_ALIAS);
}

/** Ilovaga beriladigan muhit — ikkala nishon uchun bir xil. */
export function appEnv(aiBaseUrl: string): Record<string, string> {
  return {
    NODE_ENV: "production",
    APP_URL: SMOKE_BASE_URL,
    DATABASE_URL: required("DATABASE_URL"),
    AUTH_SECRET: required("AUTH_SECRET"),
    /*
      Smoke to'plami o'nlab hisob ochadi va hammasi bitta manzildan
      keladi — production chegarasi (soatiga 10) ularni birinchi
      fayldayoq to'xtatardi. Xuddi `global-server.ts` dagidek.
    */
    REGISTER_MAX_PER_IP: "300",
    STORAGE_DRIVER: "local",
    /*
      AI — YAGONA soxtalashtirilgan chegara. Sabab `mock-ai.ts` da
      yozilgan: haqiqiy provayder pul turadi va har safar boshqa javob
      beradi. Auth, baza, HTTP, saqlagich va generatsiya sikli
      HAQIQIY ishlaydi.
    */
    AI_PROVIDER: "openai",
    AI_API_KEY: "mock-kalit",
    AI_BASE_URL: aiBaseUrl,
    AI_MODEL: "mock-lesson-model",
    VISION_AI_MODEL: "mock-vision-model",
    AI_MAX_RETRIES: "0",
    AI_TIMEOUT_MS: "15000",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} sozlanmagan. Production smoke testi HAQIQIY bazaga ulanadi — ` +
        `.env to'ldirilganini yoki CI muhitida o'zgaruvchi berilganini tekshiring.`,
    );
  }
  return value;
}

/** Server javob berguncha kutadi. */
export async function waitForHealth(baseUrl: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = "javob yo'q";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        const body = (await response.json()) as {
          data?: { database?: { connected?: boolean } };
        };
        if (body.data?.database?.connected === true) return;
        last = "bazaga ulanmagan";
      } else {
        last = `HTTP ${response.status}`;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`${baseUrl} ${timeoutMs}ms ichida tayyor bo'lmadi (${last})`);
}

// ─── Standalone nishoni ──────────────────────────────────────────────────────

/**
 * `next build` natijasini ishga tushiriladigan holatga keltiradi.
 *
 * `.next/static` va `public` standalone paketiga KIRMAYDI — Next
 * hujjatida ham shunday. Dockerfile ularni alohida ko'chiradi, bu
 * funksiya esa AYNAN o'sha qadamlarni takrorlaydi. Ya'ni standalone
 * nishoni Docker runner bosqichi bilan bir xil papka ko'rinishida
 * ishlaydi.
 */
export async function stageStandalone(): Promise<void> {
  if (!existsSync(path.join(STANDALONE_DIR, "server.js"))) {
    throw new Error(
      `${STANDALONE_DIR}/server.js topilmadi. Smoke testi tayyor build talab qiladi — ` +
        `"npm run test:smoke" buni o'zi bajaradi.`,
    );
  }

  await cp(
    path.join(REPO_ROOT, ".next", "static"),
    path.join(STANDALONE_DIR, ".next", "static"),
    { recursive: true, force: true },
  );
  await cp(path.join(REPO_ROOT, "public"), path.join(STANDALONE_DIR, "public"), {
    recursive: true,
    force: true,
  });
  // Har ishga tushirish TOZA saqlagichdan boshlansin.
  await rm(path.join(STANDALONE_DIR, "storage"), { recursive: true, force: true });
  await mkdir(path.join(STANDALONE_DIR, "storage"), { recursive: true });
}

export function spawnStandalone(port: number, env: Record<string, string>): ChildProcess {
  return spawn("node", ["server.js"], {
    cwd: STANDALONE_DIR,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
  });
}

// ─── Docker nishoni ──────────────────────────────────────────────────────────

/**
 * `docker` buyrug'ini bajaradi va stdout'ni qaytaradi.
 *
 * `input` STDIN orqali uzatiladi, buyruq qatori orqali EMAS: sir
 * qidirish sinovi qidiriladigan qiymatlarni shu yo'l bilan beradi va
 * ular xostdagi `ps` chiqishida ko'rinmasligi kerak.
 */
export async function docker(args: string[], input?: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`docker ${args[0]} yiqildi (${code}): ${stderr.trim()}`));
    });

    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}

/** Xatoni yutadi — "allaqachon yo'q" holati uchun. */
export async function dockerQuiet(args: string[]): Promise<void> {
  await docker(args).catch(() => undefined);
}

export async function buildImage(): Promise<void> {
  await docker(["build", "-t", IMAGE_TAG, REPO_ROOT]);
}

export async function runContainer(
  name: string,
  port: number,
  env: Record<string, string>,
): Promise<void> {
  const envArgs = Object.entries(env).flatMap(([key, value]) => [
    "-e",
    `${key}=${key === "DATABASE_URL" || key === "AI_BASE_URL" ? toContainerReachable(value) : value}`,
  ]);

  await docker([
    "run",
    "-d",
    "--name",
    name,
    "-p",
    `127.0.0.1:${port}:3000`,
    "--add-host",
    `${DOCKER_HOST_ALIAS}:host-gateway`,
    ...envArgs,
    IMAGE_TAG,
  ]);
}

// ─── Sinov jarayoni uchun umumiy yordamchilar ────────────────────────────────

export function targetKind(): TargetKind {
  return process.env.SMOKE_TARGET === "docker" ? "docker" : "standalone";
}

/**
 * Generatsiya natijasi FAYL sifatida artefakt ichida bormi.
 *
 * Nishonga qarab boshqa joyga qaraydi: standalone'da bu diskdagi papka,
 * Docker'da esa konteyner ichi. Sinovlar farqni bilmaydi.
 */
export async function storageFileExists(
  directory: string,
  fileName: string,
): Promise<boolean> {
  const relative = path.posix.join("storage", directory, fileName);

  if (targetKind() === "docker") {
    return docker(["exec", CONTAINER_NAME, "test", "-f", `/app/${relative}`])
      .then(() => true)
      .catch(() => false);
  }

  return stat(path.join(STANDALONE_DIR, relative))
    .then(() => true)
    .catch(() => false);
}

/**
 * Serverni QAYTA ishga tushirish hodisasini yaratadi va tugagach tozalaydi.
 *
 * Asosiy nishonga TEGILMAYDI (u boshqa sinovlarga kerak): o'sha bazaga
 * ulanadigan qisqa umrli ikkinchi nusxa ko'tariladi. `register()`
 * uchun bu yetarli — u har bir yangi server jarayonida bajariladi.
 */
export async function withRestartedInstance<T>(run: () => Promise<T>): Promise<T> {
  const aiBaseUrl = process.env.SMOKE_AI_BASE_URL ?? "";
  const env = appEnv(aiBaseUrl);
  const secondaryUrl = `http://127.0.0.1:${SECONDARY_PORT}`;
  const secondaryName = `${CONTAINER_NAME}-2`;

  if (targetKind() === "docker") {
    await dockerQuiet(["rm", "-f", secondaryName]);
    await runContainer(secondaryName, SECONDARY_PORT, env);
    try {
      await waitForHealth(secondaryUrl);
      return await run();
    } finally {
      await dockerQuiet(["rm", "-f", secondaryName]);
    }
  }

  const child = spawnStandalone(SECONDARY_PORT, env);
  try {
    await waitForHealth(secondaryUrl);
    return await run();
  } finally {
    child.kill("SIGKILL");
  }
}

/** Sinov yaratgan fayllarni artefaktdan tozalaydi (faqat standalone'da kerak). */
export async function wipeStandaloneStorage(): Promise<void> {
  const root = path.join(STANDALONE_DIR, "storage");
  const directories = await readdir(root).catch(() => []);
  for (const directory of directories) {
    await rm(path.join(root, directory), { recursive: true, force: true });
  }
}
