/**
 * E2E sinovlari uchun yordamchilar: cookie'larni eslab qoladigan mijoz va
 * sinov foydalanuvchilarini tozalash.
 */

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

/**
 * Sinov foydalanuvchilari emailining prefiksi — tozalashda aynan shularni
 * o'chiramiz, haqiqiy ma'lumotga tegmaymiz.
 */
export const TEST_EMAIL_PREFIX = "e2e-test-";

export function testEmail(suffix: string): string {
  return `${TEST_EMAIL_PREFIX}${suffix}-${Date.now()}@sinov.uz`;
}

export interface ApiResult<T> {
  status: number;
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; fieldErrors?: Record<string, string[]> };
}

/**
 * Cookie'larni saqlab qoladigan oddiy mijoz — brauzer kabi.
 *
 * `fetch` o'zi cookie saqlamaydi, shuning uchun `set-cookie` ni o'qib,
 * keyingi so'rovlarda qaytaramiz. Sessiya oqimini tekshirish uchun shu kerak.
 */
export class TestClient {
  private cookies = new Map<string, string>();

  async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<ApiResult<T>> {
    const { method = "GET", body } = options;

    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });

    this.storeCookies(response);

    let payload: ApiResult<T> = { status: response.status, ok: false };
    try {
      const json = (await response.json()) as Omit<ApiResult<T>, "status">;
      payload = { ...json, status: response.status };
    } catch {
      // JSON bo'lmagan javob (masalan redirect) — status yetarli.
    }
    return payload;
  }

  private storeCookies(response: Response): void {
    // Node 18+ da bir nechta set-cookie ni olish uchun `getSetCookie`.
    const setCookies = response.headers.getSetCookie();
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const separator = pair.indexOf("=");
      if (separator === -1) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      // Bo'sh qiymat = o'chirish buyrug'i.
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  hasCookie(name: string): boolean {
    return this.cookies.has(name);
  }

  /**
   * Xom `Response` qaytaradi — sarlavhalar va ikkilik (binary) tanani
   * tekshirish uchun.
   *
   * `request()` javobni JSON deb o'qiydi, shuning uchun .pptx fayl kabi
   * ikkilik javoblarga yaramaydi.
   */
  async fetchRaw(path: string, options: { method?: string } = {}): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      redirect: "manual",
    });
    this.storeCookies(response);
    return response;
  }

  /** Sahifaga murojaat — yo'naltirishni tekshirish uchun. */
  async visit(path: string): Promise<{ status: number; location: string | null }> {
    const headers: Record<string, string> = {};
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }
    const response = await fetch(`${BASE_URL}${path}`, {
      headers,
      redirect: "manual",
    });
    return {
      status: response.status,
      location: response.headers.get("location"),
    };
  }
}

/**
 * Sinov davomida yaratilgan foydalanuvchilarni va ularning FAYLLARINI
 * o'chiradi.
 *
 * DIQQAT: foydalanuvchi o'chirilganda prezentatsiya va kalendar reja yozuvlari cascade
 * bilan o'chadi, lekin diskdagi .pptx/.xlsx fayllar QOLIB KETADI — baza
 * cascade'i fayl tizimini bilmaydi. Shuning uchun avval fayllar,
 * keyin foydalanuvchilar o'chiriladi.
 */
export async function cleanupTestUsers(): Promise<void> {
  const { prisma } = await import("../../../lib/db");
  const { deleteFile } = await import("../../../lib/storage/files");

  const testUser = { email: { startsWith: TEST_EMAIL_PREFIX } };

  const [presentations, calendarPlans] = await Promise.all([
    prisma.presentation.findMany({
      where: { filePath: { not: null }, user: testUser },
      select: { filePath: true },
    }),
    prisma.calendarPlan.findMany({
      where: { filePath: { not: null }, user: testUser },
      select: { filePath: true },
    }),
  ]);

  await Promise.all([
    ...presentations.map((row) => deleteFile("pptx", row.filePath!)),
    ...calendarPlans.map((row) => deleteFile("xlsx", row.filePath!)),
  ]);

  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
}

/**
 * Soxta AI serveriga yuborilgan promptlarni o'qiydi.
 *
 * Soxta server alohida jarayonda (test runner ichida) ishlaydi, shuning
 * uchun ular HTTP orqali olinadi — `startMockAiServer` dagi `/__prompts`
 * endpointiga qara.
 */
export async function readAiPrompts(): Promise<Array<{ system: string; user: string }>> {
  const baseUrl = process.env.AI_BASE_URL;
  if (baseUrl === undefined || baseUrl === "") {
    throw new Error("AI_BASE_URL sozlanmagan — globalSetup ishga tushmaganmi?");
  }

  const response = await fetch(`${baseUrl}/__prompts`);
  const body = (await response.json()) as {
    prompts: Array<{ system: string; user: string }>;
  };
  return body.prompts;
}

/**
 * Berilgan matnni O'Z ICHIGA OLGAN promptni topadi.
 *
 * Nega shunchaki "oxirgi prompt" emas: prompt jurnali umumiy va unga
 * boshqa generatsiyalar ham yozilishi mumkin. Mavzu bo'yicha qidirish esa
 * qaysi chaqiruv tekshirilayotganini ANIQ belgilaydi — sinov "nechta
 * so'rov bo'ldi" degan mo'rt taxminga tayanmaydi.
 */
export async function findAiPrompt(
  needle: string,
): Promise<{ system: string; user: string }> {
  const prompts = await readAiPrompts();
  const match = prompts.filter((prompt) => prompt.user.includes(needle));

  if (match.length === 0) {
    throw new Error(
      `AI'ga "${needle}" matnli prompt yuborilmagan. ` +
        `Jami ${prompts.length} ta prompt bor.`,
    );
  }
  // Bir nechta bo'lsa oxirgisi — eng so'nggi chaqiruv.
  return match.at(-1)!;
}

/** Yozib olingan promptlarni tozalaydi — sinovlar bir-biriga xalaqit bermasin. */
export async function clearAiPrompts(): Promise<void> {
  const baseUrl = process.env.AI_BASE_URL;
  if (baseUrl === undefined || baseUrl === "") return;
  await fetch(`${baseUrl}/__prompts`, { method: "DELETE" });
}

/**
 * Fon rejimidagi generatsiya tugashini kutadi.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * POST endi `202` va PENDING yozuvni qaytaradi — natija tayyor emas.
 * Sinovlar natijani tekshirishdan oldin uni KUTISHI kerak, xuddi
 * foydalanuvchi brauzeri kabi (polling).
 *
 * Cheksiz kutmaydi: `timeoutMs` dan oshsa xato tashlaydi va oxirgi
 * holatni aytadi — shunda nosozlik sababi aniq bo'ladi.
 */
export async function waitForGeneration<T extends { status: string }>(
  client: TestClient,
  path: string,
  payloadKey: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 30_000, intervalMs = 100 } = options;
  const deadline = Date.now() + timeoutMs;

  let last: T | undefined;

  while (Date.now() < deadline) {
    const result = await client.request<Record<string, T>>(path);

    if (!result.ok) {
      throw new Error(
        `${path} o'qib bo'lmadi: ${result.status} ${result.error?.code ?? ""}`,
      );
    }

    last = result.data![payloadKey];
    if (last.status !== "PENDING") return last;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `${path} ${timeoutMs}ms ichida tugamadi (oxirgi holat: ${last?.status ?? "noma'lum"})`,
  );
}
