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
    usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
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
});
