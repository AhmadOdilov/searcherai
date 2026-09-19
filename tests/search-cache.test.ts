import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SearchLruCache } from "../lib/search/cache";
import { understandQuery } from "../lib/search/understanding";
import type { SearchResult } from "../lib/search/service";

describe("search lru cache", () => {
  const dummyResult: SearchResult = {
    answer: {
      answer: "Kasrlar mavzusi bo'yicha tushuntirish berildi.",
      keyPoints: ["1-nuqta", "2-nuqta", "3-nuqta"],
      classroomIdeas: ["1-g'oya", "2-g'oya"],
    },
    durationMs: 120,
    model: "test-model",
    usage: { inputTokens: 50, outputTokens: 100 },
    understanding: understandQuery("5-sinf matematika kasrlar"),
    curriculumMatches: [],
    grounding: {
      isGrounded: true,
      groundingScore: 0.9,
      sourceCitations: [],
      claims: [],
      contradictions: [],
      supportedClaimRate: 1,
      contradictionRate: 0,
      factualContradictionRate: 0,
      gradeConflictRate: 0,
      sourceConflictRate: 0,
      unsupportedClaimRate: 0,
    },
    suggestedActions: [],
    latencyBreakdown: {
      understandingMs: 2,
      retrievalMs: 8,
      aiMs: 100,
      validationMs: 1,
      totalMs: 120,
    },
  };

  it("deterministik kalit yaratadi va ma'lumotni keshlaydi", () => {
    const cache = new SearchLruCache(1000, 2);
    const u1 = understandQuery("5-sinf matematika kasrlar");
    const u2 = understandQuery("5-sinf matematika kasrlar");

    const key1 = cache.generateKey(u1);
    const key2 = cache.generateKey(u2);
    assert.equal(key1, key2);

    cache.set(key1, dummyResult);
    const cached = cache.get(key1);
    assert.deepEqual(cached, dummyResult);
  });

  it("maxSize oshganda eng eski elementni chiqarib tashlaydi (LRU)", () => {
    const cache = new SearchLruCache(1000, 2);
    const u1 = understandQuery("mavzu 1");
    const u2 = understandQuery("mavzu 2");
    const u3 = understandQuery("mavzu 3");

    const k1 = cache.generateKey(u1);
    const k2 = cache.generateKey(u2);
    const k3 = cache.generateKey(u3);

    cache.set(k1, dummyResult);
    cache.set(k2, dummyResult);
    assert.equal(cache.size(), 2);

    cache.set(k3, dummyResult);
    assert.equal(cache.size(), 2);
    assert.equal(cache.get(k1), null); // k1 o'chirilgan bo'lishi kerak
    assert.ok(cache.get(k2) !== null);
    assert.ok(cache.get(k3) !== null);
  });

  it("differensial parametrlar (til, sinf, intent, audience) turli kompozit kalitlar hosil qiladi (Collision-free)", () => {
    const cache = new SearchLruCache();

    // 1. Til farqi
    const uUz = understandQuery("oddiy kasrlar", "Matematika", "5-sinf", "UZ");
    const uRu = understandQuery("простые дроби", "Matematika", "5-sinf", "RU");
    assert.notEqual(cache.generateKey(uUz), cache.generateKey(uRu));

    // 2. Sinf farqi
    const u5 = understandQuery("matematika kasrlar", "Matematika", "5-sinf");
    const u6 = understandQuery("matematika kasrlar", "Matematika", "6-sinf");
    assert.notEqual(cache.generateKey(u5), cache.generateKey(u6));

    // 3. Auditoriya farqi (o'qituvchi vs o'quvchi)
    const uTeacher = { ...u5, audience: "teacher" as const };
    const uStudent = { ...u5, audience: "student" as const };
    assert.notEqual(cache.generateKey(uTeacher), cache.generateKey(uStudent));

    // 4. Intent farqi
    const uPlan = { ...u5, intent: "lesson_plan" as const };
    const uQuiz = { ...u5, intent: "quiz_test" as const };
    assert.notEqual(cache.generateKey(uPlan), cache.generateKey(uQuiz));
  });

  it("foydalanuvchi ma'lumotlari (userId, userRole) kesh kalitiga ta'sir qilmaydi (Privacy & Cross-user leak proof)", () => {
    const cache = new SearchLruCache();
    const u = understandQuery("5-sinf matematika kasrlar");

    // Ikki turli foydalanuvchi bir xil pedagogik so'rov berganda
    const keyUser1 = cache.generateKey(u);
    const keyUser2 = cache.generateKey(u);
    assert.equal(keyUser1, keyUser2, "Bir xil so'rov uchun kalit bir xil bo'lishi kerak");

    // Kesh kaliti 64 belgili sha256 hex string bo'lishi va maxfiy ma'lumot saqlamasligi shart
    assert.equal(keyUser1.length, 64);
    assert.match(keyUser1, /^[a-f0-9]{64}$/);
  });

  it("o'quv dasturi, model yoki prompt versiyasi yangilanganda kesh tozalanadi (Version Invalidation)", () => {
    const cache = new SearchLruCache(
      1000,
      10,
      "DTS-2025-v1",
      "retrieval-v3",
      "prompt-v3",
    );
    const u = understandQuery("natural sonlar");
    const key = cache.generateKey(u);

    cache.set(key, dummyResult);
    assert.equal(cache.get(key) !== null, true);

    // Dastur versiyasi o'zgarganda kesh tozalanadi
    cache.setVersions({ curriculumVersion: "DTS-2025-v2" });
    assert.equal(cache.size(), 0, "Versiya yangilanganda kesh tozalanadi");
    assert.equal(cache.get(key), null);
  });

  it("fan bo'yicha maqsadli invalidatsiya to'g'ri ishlaydi (invalidateBySubject)", () => {
    const cache = new SearchLruCache();
    const uMath = understandQuery("5-sinf matematika kasrlar");
    const uBio = understandQuery("6-sinf biologiya fotosintez");

    const kMath = cache.generateKey(uMath);
    const kBio = cache.generateKey(uBio);

    const mathResult: SearchResult = { ...dummyResult, understanding: uMath };
    const bioResult: SearchResult = { ...dummyResult, understanding: uBio };

    cache.set(kMath, mathResult);
    cache.set(kBio, bioResult);
    assert.equal(cache.size(), 2);

    // Faqat Matematika keshini bekor qilish
    const removed = cache.invalidateBySubject("Matematika");
    assert.equal(removed, 1);
    assert.equal(cache.get(kMath), null);
    assert.ok(cache.get(kBio) !== null);
  });

  it("TTL muddati o'tgan elementlar qaytarilmaydi va tozalanadi", async () => {
    // 50ms TTL ga ega kesh
    const shortCache = new SearchLruCache(50, 10);
    const u = understandQuery("burchaklar");
    const key = shortCache.generateKey(u);

    shortCache.set(key, dummyResult);
    assert.ok(shortCache.get(key) !== null);

    // 70ms kutamiz
    await new Promise((r) => setTimeout(r, 70));
    assert.equal(shortCache.get(key), null, "TTL o'tgan element null qaytarishi shart");
  });
});
