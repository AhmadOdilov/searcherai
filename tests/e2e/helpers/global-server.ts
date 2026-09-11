import { spawn, type ChildProcess } from "node:child_process";

/**
 * E2E sinovlari uchun haqiqiy Next.js serverini ko'taradi.
 *
 * Nega kerak: register/login/logout oqimi cookie'lar, `next/headers` va
 * bazaga tayanadi. Route handler'ni to'g'ridan-to'g'ri chaqirsak, so'rov
 * konteksti bo'lmaydi va `cookies()` xato beradi. Shuning uchun sinovlar
 * haqiqiy HTTP orqali ishlaydi — foydalanuvchi qanday ishlatsa, shunday.
 *
 * Node'ning test runner'i bu faylni `--test-global-setup` orqali bir marta
 * ishga tushiradi.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

let server: ChildProcess | null = null;

/** Server javob berishini kutadi. */
async function waitForServer(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "javob yo'q";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        const body = (await response.json()) as {
          data?: { database?: { connected?: boolean } };
        };
        if (body.data?.database?.connected === true) return;
        lastError = "bazaga ulanmagan";
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(
    `E2E server ${timeoutMs}ms ichida tayyor bo'lmadi (oxirgi holat: ${lastError}). ` +
      `Baza ishlayaptimi? DATABASE_URL to'g'rimi?`,
  );
}

export async function globalSetup(): Promise<void> {
  process.env.E2E_BASE_URL = BASE_URL;

  server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    // Serverning loglari sinov chiqishini to'ldirmasin, lekin xato
    // bo'lganda ko'rish uchun stderr ochiq qoladi.
    stdio: ["ignore", "ignore", "inherit"],
    env: process.env,
  });

  server.on("error", (error) => {
    console.error("E2E serverni ishga tushirib bo'lmadi:", error);
  });

  await waitForServer();
}

export async function globalTeardown(): Promise<void> {
  if (!server || server.exitCode !== null) return;

  // `next dev` o'z bola jarayonlarini yaratadi — butun guruhni to'xtatamiz.
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
}
