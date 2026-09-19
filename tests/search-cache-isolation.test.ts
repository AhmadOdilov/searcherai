import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SearchLruCache } from "../lib/search/cache";
import { understandQuery } from "../lib/search/understanding";

/*
  §12: bir xil so'rov turli kontekstlarda ALOHIDA kesh yozuvi bo'lishi shart.
  Aks holda bir foydalanuvchining 5-sinf javobi boshqasining 9-sinf
  so'roviga qaytarilishi mumkin (cache collision).
*/
describe("kesh kaliti izolyatsiyasi (§12)", () => {
  const cache = new SearchLruCache();

  it("o'quv dasturi versiyasi boshqa bo'lsa kalit ham boshqa", () => {
    const u = understandQuery("8-sinf matematika kvadrat tenglamalar");
    const k2025 = cache.generateKey(u, "DTS-UZBMB-2025-v1");
    const k2026 = cache.generateKey(u, "DTS-UZBMB-2026-v1");

    assert.notEqual(k2025, k2026);
  });

  it("sinf, til, intent va auditoriya har biri kalitni o'zgartiradi", () => {
    const base = understandQuery("matematika kvadrat tenglamalar tushuntir");
    const baseKey = cache.generateKey(base);

    const variants = [
      "8-sinf matematika kvadrat tenglamalar tushuntir",
      "математика квадратные уравнения объясни",
      "matematika kvadrat tenglamalar dars ishlanma",
      "matematika kvadrat tenglamalar bolaga tushuntir",
    ];

    const keys = new Set([baseKey]);
    for (const variant of variants) {
      keys.add(cache.generateKey(understandQuery(variant)));
    }

    assert.equal(
      keys.size,
      variants.length + 1,
      "har bir variant alohida kalit olishi kerak",
    );
  });

  it("kalit DETERMINISTIK — bir xil so'rov bir xil kalit beradi", () => {
    const a = cache.generateKey(understandQuery("9-sinf matematika trigonometriya"));
    const b = cache.generateKey(understandQuery("9-sinf matematika trigonometriya"));
    assert.equal(a, b);
  });

  it("kalitda shaxsiy ma'lumot bo'lmaydi — u sof xesh", () => {
    const key = cache.generateKey(
      understandQuery("8-sinf matematika kvadrat tenglamalar"),
    );
    assert.match(key, /^[0-9a-f]{64}$/);
  });

  it("versiya yangilanganda eski yozuvlar tozalanadi (stale data)", () => {
    const local = new SearchLruCache();
    const u = understandQuery("8-sinf matematika kvadrat tenglamalar");
    const key = local.generateKey(u);

    // Kesh ichiga minimal, lekin haqiqiy shaklga mos yozuv qo'yamiz.
    local.set(key, { understanding: u } as never);
    assert.notEqual(local.get(key), null);

    local.setCurriculumVersion("DTS-UZBMB-2026-v1");
    assert.equal(local.size(), 0, "versiya o'zgarganda kesh tozalanishi kerak");
  });
});
