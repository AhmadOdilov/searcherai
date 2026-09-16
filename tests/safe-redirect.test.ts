import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeInternalPath } from "../lib/auth/safe-redirect";

/**
 * Kirishdan keyingi qaytish manzili.
 *
 * ── Nega bu sinov bor ─────────────────────────────────────────────────────
 * Ilgari tekshiruv satr shakliga qarardi (`/` bilan boshlanadi, `//`
 * bilan emas). Brauzer esa manzilni URL qoidasi bo'yicha o'qiydi va u
 * yerda TESKARI CHIZIQ oldinga chiziqqa teng — ya'ni `/\begona.example`
 * tekshiruvdan o'tar, lekin begona saytga olib chiqardi.
 *
 * Quyidagi ro'yxat aynan shu chetlab o'tish usullarini qamraydi.
 */
describe("safeInternalPath — begona manzillar rad etiladi", () => {
  const external = [
    // Klassik protokolsiz manzil.
    "//begona.example",
    // Teskari chiziq — asosiy chetlab o'tish usuli.
    "/\\begona.example",
    "/\\\\begona.example",
    // URL tahlilchisi tab va yangi qatorni TASHLAB YUBORADI, ya'ni
    // qolgani `//begona.example` ga aylanadi.
    "/\t/begona.example",
    "/\n/begona.example",
    "/\r/begona.example",
    // To'liq manzil.
    "https://begona.example/kirish",
    "http://begona.example",
    // Kod bajaradigan manzil — Next.js hujjati buni alohida ogohlantiradi.
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ];

  for (const value of external) {
    it(`rad etadi: ${JSON.stringify(value)}`, () => {
      assert.equal(safeInternalPath(value), "/dashboard");
    });
  }
});

describe("safeInternalPath — ichki yo'llar saqlanadi", () => {
  it("oddiy yo'l o'zgarmaydi", () => {
    assert.equal(
      safeInternalPath("/dashboard/presentations"),
      "/dashboard/presentations",
    );
  });

  it("so'rov qismi SAQLANADI", () => {
    /*
      `proxy.ts` `next` ga `pathname + search` ni yozadi — filtr yoki
      sahifa raqami yo'qolsa, foydalanuvchi kirgandan keyin boshqa
      ro'yxatga tushib qolardi.
    */
    assert.equal(
      safeInternalPath("/dashboard/lesson-plans?status=READY&limit=20"),
      "/dashboard/lesson-plans?status=READY&limit=20",
    );
  });

  it("langar (hash) ham saqlanadi", () => {
    assert.equal(safeInternalPath("/dashboard#asosiy"), "/dashboard#asosiy");
  });

  it("bo'sh va yo'q qiymatlar standart manzilga tushadi", () => {
    assert.equal(safeInternalPath(null), "/dashboard");
    assert.equal(safeInternalPath(undefined), "/dashboard");
    assert.equal(safeInternalPath(""), "/dashboard");
  });

  it("standart manzilni almashtirish mumkin", () => {
    assert.equal(safeInternalPath("//begona.example", "/login"), "/login");
  });

  it("nisbiy yo'l ham normallashtiriladi", () => {
    // `/..` bilan yuqoriga chiqishga urinish ildizda to'xtaydi.
    assert.equal(safeInternalPath("/../../etc"), "/etc");
  });
});
