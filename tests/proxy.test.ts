import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";

/**
 * `proxy.ts` sinovlari — baza kerak emas, chunki proxy ataylab bazaga
 * murojaat qilmaydi (faqat cookie'dagi imzoni tekshiradi).
 */

const SECRET = "sinov-uchun-kalit-kamida-32-belgi-boisin!!";

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
});

/** Berilgan yo'lga so'rov yasaydi, xohlasa sessiya cookie'si bilan. */
async function makeRequest(
  path: string,
  options: { token?: string } = {},
): Promise<NextRequest> {
  const { SESSION_COOKIE } = await import("../lib/auth/jwt");
  const request = new NextRequest(new URL(path, "http://localhost:3000"));
  if (options.token !== undefined) {
    request.cookies.set(SESSION_COOKIE, options.token);
  }
  return request;
}

/** Yaroqli sessiya tokeni. */
async function validToken(): Promise<string> {
  const { signSessionToken, sessionExpiry } = await import("../lib/auth/jwt");
  return signSessionToken({ sid: "sessiya-1", uid: "foydalanuvchi-1" }, sessionExpiry());
}

describe("proxy — himoyalangan sahifalar", () => {
  it("token yo'q bo'lsa /dashboard dan /login ga yo'naltiradi", async () => {
    const { proxy } = await import("../proxy");

    const response = await proxy(await makeRequest("/dashboard"));

    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.pathname, "/login");
  });

  it("so'ralgan sahifani ?next= da saqlaydi", async () => {
    const { proxy } = await import("../proxy");

    const response = await proxy(await makeRequest("/dashboard/lessons?fan=matematika"));

    const location = new URL(response.headers.get("location")!);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("next"), "/dashboard/lessons?fan=matematika");
  });

  it("yaroqli token bilan /dashboard ga o'tkazadi", async () => {
    const { proxy } = await import("../proxy");

    const response = await proxy(
      await makeRequest("/dashboard", { token: await validToken() }),
    );

    // NextResponse.next() — yo'naltirish yo'q.
    assert.equal(response.headers.get("location"), null);
  });

  it("yaroqsiz tokenni tozalaydi va /login ga yuboradi", async () => {
    const { proxy } = await import("../proxy");
    const { SESSION_COOKIE } = await import("../lib/auth/jwt");

    const response = await proxy(
      await makeRequest("/dashboard", { token: "buzilgan-token" }),
    );

    assert.equal(new URL(response.headers.get("location")!).pathname, "/login");

    // Cookie o'chirilgan bo'lishi kerak — aks holda brauzer uni har
    // so'rovda qayta yuboradi va foydalanuvchi tsiklga tushadi.
    const cleared = response.cookies.get(SESSION_COOKIE);
    assert.ok(cleared !== undefined, "cookie o'chirish buyrug'i bo'lishi kerak");
    assert.equal(cleared.value, "");
  });

  it("muddati o'tgan token yaroqsiz hisoblanadi", async () => {
    const { proxy } = await import("../proxy");
    const { signSessionToken } = await import("../lib/auth/jwt");

    const expired = await signSessionToken(
      { sid: "s", uid: "u" },
      new Date(Date.now() - 60_000),
    );
    const response = await proxy(await makeRequest("/dashboard", { token: expired }));

    assert.equal(new URL(response.headers.get("location")!).pathname, "/login");
  });
});

describe("proxy — kirish sahifalari", () => {
  it("kirgan foydalanuvchini /login dan /dashboard ga yuboradi", async () => {
    const { proxy } = await import("../proxy");

    const response = await proxy(
      await makeRequest("/login", { token: await validToken() }),
    );

    assert.equal(new URL(response.headers.get("location")!).pathname, "/dashboard");
  });

  it("kirmagan foydalanuvchiga /login ni ko'rsatadi", async () => {
    const { proxy } = await import("../proxy");

    const response = await proxy(await makeRequest("/login"));

    assert.equal(response.headers.get("location"), null);
  });

  it("kirgan foydalanuvchini /register dan ham qaytaradi", async () => {
    const { proxy } = await import("../proxy");

    const response = await proxy(
      await makeRequest("/register", { token: await validToken() }),
    );

    assert.equal(new URL(response.headers.get("location")!).pathname, "/dashboard");
  });
});
