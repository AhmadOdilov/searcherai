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

/** Sinov davomida yaratilgan foydalanuvchilarni o'chiradi. */
export async function cleanupTestUsers(): Promise<void> {
  const { prisma } = await import("../../../lib/db");
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
}
