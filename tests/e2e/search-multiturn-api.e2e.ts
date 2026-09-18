import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";

/**
 * V6 PHASE 4 — ko'p bosqichli suhbat MAHSULOT darajasida ishlaydimi?
 *
 * ── Nega bu test kerak ────────────────────────────────────────────────────
 * `scripts/evaluate-v5-multiturn.ts` kutubxona qatlamida 100% ko'rsatadi,
 * chunki u `MultiTurnService` ni TO'G'RIDAN-TO'G'RI chaqiradi. Bu esa
 * mahsulotda xususiyat ishlayotganini isbotlamaydi.
 *
 * Ushbu test HTTP yo'nalishi orqali o'tadi va hozirgi HAQIQIY holatni
 * qayd etadi: `/api/search` suhbat kontekstini qabul qilmaydi.
 *
 * Test ATAYLAB shu holatni tasdiqlaydi, chunki:
 *   · hisobotda "multi-turn 100%" deb yozish yolg'on bo'lardi;
 *   · kontekst ulanganda bu test YIQILADI va uni yangilash kerak bo'ladi —
 *     ya'ni u cheklovning bexosdan unutilishiga yo'l qo'ymaydi.
 */

const PASSWORD = "juda-maxfiy-parol";

interface SearchPayload {
  answer: { answer: string; keyPoints: string[]; classroomIdeas: string[] };
  understanding?: {
    detectedSubject?: string;
    detectedGrade?: string;
    extractedTopic: string;
  };
}

async function signedInClient(suffix: string): Promise<TestClient> {
  const client = new TestClient();
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email: testEmail(suffix), password: PASSWORD, fullName: "Sinov O'qituvchi" },
  });
  assert.equal(result.status, 201);
  return client;
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("multi-turn API holati (V6 — hozirgi cheklov qayd etiladi)", () => {
  it("API suhbat identifikatorini QABUL QILMAYDI — u jimgina tashlab yuboriladi", async () => {
    const client = await signedInClient("mt-api-contract");

    const result = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: {
        question: "8-sinf matematika kvadrat tenglamalar nima?",
        language: "UZ",
        conversationId: "some-thread-id",
        previousTopic: "kvadrat tenglamalar",
      },
    });

    // So'rov rad etilmaydi (qo'shimcha maydonlar sxemadan tushib qoladi),
    // lekin kontekst hech qayerda ishlatilmaydi.
    assert.equal(result.status, 200);
  });

  it("MODIFIKATOR so'rov oldingi mavzuni SAQLAMAYDI (hozirgi holat)", async () => {
    const client = await signedInClient("mt-api-modifier");

    const first = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "8-sinf matematika kvadrat tenglamalar nima?", language: "UZ" },
    });
    assert.equal(first.status, 200);
    const firstTopic = first.data!.understanding?.extractedTopic ?? "";
    assert.match(firstTopic, /kvadrat|tenglama/i, "birinchi bosqichda mavzu aniqlanishi kerak");

    // Keyingi bosqich — faqat modifikator.
    const second = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "endi buni oddiyroq tushuntir", language: "UZ" },
    });
    assert.equal(second.status, 200);

    const secondTopic = second.data!.understanding?.extractedTopic ?? "";
    assert.doesNotMatch(
      secondTopic,
      /kvadrat tenglama/i,
      "HOZIRGI HOLAT: kontekst uzatilmagani uchun mavzu saqlanmaydi. " +
        "Agar bu tasdiq yiqilsa — multi-turn API'ga ulangan, testni va " +
        "hisobotdagi cheklovni yangilang.",
    );
  });

  it("fan ham saqlanmaydi — har bir so'rov mustaqil ishlanadi", async () => {
    const client = await signedInClient("mt-api-subject");

    await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "6-sinf ona tili so'z turkumlari haqida", language: "UZ" },
    });

    const follow = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "misol ber", language: "UZ" },
    });

    assert.equal(follow.status, 200);
    assert.notEqual(
      follow.data!.understanding?.detectedSubject,
      "Ona tili",
      "HOZIRGI HOLAT: oldingi fan meros qilib olinmaydi.",
    );
  });
});
