import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickClientIp } from "../lib/auth/client-ip";

/**
 * Mijoz manzilini tanlash — XAVFSIZLIK sinovi.
 *
 * ── Nega bu sinov muhim ───────────────────────────────────────────────────
 * Bu funksiya IP bo'yicha barcha cheklovlarning asosi. Agar u mijoz
 * boshqaradigan qiymatni qaytarsa, hujumchi har so'rovda o'zini boshqa
 * manzil deb ko'rsatib, ro'yxatdan o'tish kvotasini (ya'ni AI xarajatining
 * yagona to'sig'ini) butunlay chetlab o'tadi.
 *
 * Aynan shu nosozlik audit paytida topildi: ilgari kod
 * `X-Forwarded-For` ning BIRINCHI elementini olardi, Nginx esa mijoz
 * yuborgan qiymatga haqiqiy manzilni QO'SHADI — ya'ni birinchi element
 * har doim hujumchiniki bo'ladi.
 *
 * ── Nega sof funksiya sinaladi ────────────────────────────────────────────
 * `clientIp()` `next/headers` ga tayanadi va so'rov konteksti talab
 * qiladi. `pickClientIp()` esa oddiy `Headers` oladi — shuning uchun
 * server ko'tarmasdan, har bir chegara holatini aniq sinash mumkin.
 */

function h(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("pickClientIp — soxtalashtirishga qarshi", () => {
  it("HUJUM: mijoz yozgan X-Forwarded-For qabul qilinmaydi", () => {
    /*
      Nginx ortidagi haqiqiy holat: hujumchi "1.2.3.4" yuboradi, Nginx
      uning oxiriga haqiqiy manzilni qo'shadi va X-Real-IP ni o'zi
      belgilaydi.
    */
    const ip = pickClientIp(
      h({
        "x-forwarded-for": "1.2.3.4, 198.51.100.10",
        "x-real-ip": "198.51.100.10",
      }),
    );

    assert.equal(ip, "198.51.100.10", "hujumchi yozgan qiymat qaytdi");
    assert.notEqual(ip, "1.2.3.4");
  });

  it("HUJUM: X-Real-IP bo'lmasa ham birinchi element olinmaydi", () => {
    // Proksi X-Real-IP qo'ymagan holat — oxirgi element ishonchliroq.
    const ip = pickClientIp(h({ "x-forwarded-for": "1.2.3.4, 198.51.100.10" }));

    assert.equal(ip, "198.51.100.10");
  });

  it("HUJUM: ko'p bosqichli soxta zanjirda ham oxirgisi olinadi", () => {
    const ip = pickClientIp(
      h({ "x-forwarded-for": "9.9.9.9, 8.8.8.8, 7.7.7.7, 203.0.113.5" }),
    );

    assert.equal(ip, "203.0.113.5");
  });

  it("HUJUM: uzun axlat sarlavha bazaga tushmaydi", () => {
    /*
      `identifier` ustuniga yoziladigan qiymat — shuning uchun hajmi
      va shakli tekshiriladi, aks holda jadvalni shishirish mumkin.
    */
    const rubbish = "a".repeat(9000);

    assert.equal(pickClientIp(h({ "x-real-ip": rubbish })), null);
    assert.equal(pickClientIp(h({ "x-forwarded-for": rubbish })), null);
  });

  it("HUJUM: manzil shaklida bo'lmagan matn rad etiladi", () => {
    assert.equal(pickClientIp(h({ "x-real-ip": "Robert'); DROP TABLE--" })), null);
    assert.equal(pickClientIp(h({ "x-real-ip": "hech-kim" })), null);
  });
});

describe("pickClientIp — odatdagi holatlar", () => {
  it("X-Real-IP birinchi o'rinda turadi", () => {
    const ip = pickClientIp(
      h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1" }),
    );

    assert.equal(ip, "203.0.113.7");
  });

  it("faqat X-Forwarded-For bo'lsa undan oladi", () => {
    assert.equal(pickClientIp(h({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
  });

  it("hech qanday sarlavha bo'lmasa null", () => {
    assert.equal(pickClientIp(h({})), null);
  });

  it("bo'sh sarlavha null qaytaradi", () => {
    assert.equal(pickClientIp(h({ "x-real-ip": "   " })), null);
    assert.equal(pickClientIp(h({ "x-forwarded-for": " , , " })), null);
  });

  it("X-Real-IP buzuq bo'lsa X-Forwarded-For ga tushadi", () => {
    const ip = pickClientIp(
      h({ "x-real-ip": "buzuq qiymat", "x-forwarded-for": "1.2.3.4, 203.0.113.11" }),
    );

    assert.equal(ip, "203.0.113.11");
  });

  it("IPv6 qo'llab-quvvatlanadi", () => {
    assert.equal(pickClientIp(h({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  });

  it("IPv6 qavslari olib tashlanadi", () => {
    // "[::1]" va "::1" BITTA manzil — hisoblagichda ikki kalit bo'lmasin.
    assert.equal(pickClientIp(h({ "x-real-ip": "[::1]" })), "::1");
  });

  it("IPv6 zona qo'shimchasi olib tashlanadi", () => {
    assert.equal(pickClientIp(h({ "x-real-ip": "fe80::1%eth0" })), "fe80::1");
  });

  it("bo'shliqlar tozalanadi", () => {
    assert.equal(
      pickClientIp(h({ "x-forwarded-for": "  1.2.3.4 ,  203.0.113.13  " })),
      "203.0.113.13",
    );
  });
});
