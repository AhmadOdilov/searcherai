import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  MultiTurnService,
  deriveConversationContext,
} from "../lib/search/multi-turn-service";
import { understandQuery } from "../lib/search/understanding";

describe("MultiTurnService (Phase 10 Backend Context & Security)", () => {
  beforeEach(() => {
    MultiTurnService._clearAll();
  });

  it("1. Creates thread and records turns with context inheritance", () => {
    const userId = "teacher-user-123";
    const thread = MultiTurnService.createThread(userId, "Fotosintez darsi");

    // Turn 1: "Fotosintez nima?"
    const u1 = understandQuery("Fotosintez nima?");
    MultiTurnService.addTurn(
      thread.id,
      userId,
      "Fotosintez nima?",
      u1,
      "Fotosintez - yorug'lik energiyasi...",
    );

    const ctxAfterT1 = MultiTurnService.getContextForNextTurn(thread.id, userId);
    assert.ok(ctxAfterT1);
    assert.strictEqual(ctxAfterT1.previousSubject, "Biologiya");

    // Turn 2: "6-sinf uchun" (sinf qo'shildi, mavzu meros qilinadi)
    const u2 = understandQuery(
      "6-sinf uchun",
      undefined,
      undefined,
      undefined,
      ctxAfterT1,
    );
    MultiTurnService.addTurn(thread.id, userId, "6-sinf uchun", u2);

    const ctxAfterT2 = MultiTurnService.getContextForNextTurn(thread.id, userId);
    assert.ok(ctxAfterT2);
    assert.strictEqual(ctxAfterT2.previousGrade, "6-sinf");
    assert.strictEqual(ctxAfterT2.previousSubject, "Biologiya");

    // Turn 3: "10 ta test tuz" (intent qo'shildi, mavzu va sinf saqlanadi)
    const u3 = understandQuery(
      "10 ta test tuz",
      undefined,
      undefined,
      undefined,
      ctxAfterT2,
    );
    MultiTurnService.addTurn(thread.id, userId, "10 ta test tuz", u3);

    assert.strictEqual(u3.detectedIntent, "quiz_test");
    assert.strictEqual(u3.detectedGrade, "6-sinf");
    assert.strictEqual(u3.detectedSubject, "Biologiya");
  });

  it("2. IDOR / BOLA Security Guard: User B cannot access User A thread", () => {
    const userA = "teacher-alice";
    const userB = "intruder-bob";

    const threadA = MultiTurnService.createThread(userA, "Alice shaxsiy rejasi");
    const uA = understandQuery("5-sinf kasrlar dars ishlanmasi");
    MultiTurnService.addTurn(threadA.id, userA, "5-sinf kasrlar dars ishlanmasi", uA);

    // Intruder Bob trying to get Alice's thread
    assert.throws(
      () => {
        MultiTurnService.getThread(threadA.id, userB);
      },
      (err: Error) => {
        return (
          err.message.includes("IDOR detected") ||
          err.message.includes("Ruxsatsiz kirish")
        );
      },
      "IDOR ruxsatsiz kirish to'xtatilmadi",
    );

    // Intruder Bob trying to add turn to Alice's thread
    assert.throws(
      () => {
        MultiTurnService.addTurn(threadA.id, userB, "hacker query", uA);
      },
      (err: Error) => {
        return (
          err.message.includes("IDOR detected") ||
          err.message.includes("Ruxsatsiz kirish")
        );
      },
    );
  });

  it("3. Retention policy: Caps turns at MAX_TURNS_PER_THREAD", () => {
    const userId = "teacher-heavy";
    const thread = MultiTurnService.createThread(userId, "Uzoq suhbat");

    for (let i = 1; i <= 60; i++) {
      const u = understandQuery(`Savol ${i}`);
      MultiTurnService.addTurn(thread.id, userId, `Savol ${i}`, u);
    }

    const fetched = MultiTurnService.getThread(thread.id, userId);
    assert.ok(fetched);
    assert.strictEqual(fetched.turns.length, 50); // capped at 50
    assert.strictEqual(fetched.turns[fetched.turns.length - 1].query, "Savol 60");
  });

  it("4. Context Window Control at scale: 10, 100, 1000 messages performance & summary", () => {
    const userId = "scale-tester";
    const thread = MultiTurnService.createThread(userId, "Scale test thread");

    const t0 = performance.now();
    for (let i = 1; i <= 1000; i++) {
      const u = understandQuery(`Savol ${i} matematika kasrlar`);
      MultiTurnService.addTurn(thread.id, userId, `Savol ${i}`, u);
    }
    const tDuration = performance.now() - t0;

    // 1000 iterations must complete smoothly under 500ms (sub-millisecond per turn)
    assert.ok(tDuration < 500, `1000 turn qo'shish juda sekin: ${tDuration}ms`);

    // Must be safely capped at 50 turns
    const currentThread = MultiTurnService.getThread(thread.id, userId);
    assert.ok(currentThread);
    assert.strictEqual(currentThread.turns.length, 50);

    // Summary test
    const win = MultiTurnService.getContextWindowSummary(thread.id, userId, 5);
    assert.strictEqual(win.recentTurns.length, 5);
    assert.ok(win.summary.includes("Avvalgi bosqichlarda muhokama qilingan mavzular"));
  });
});

/**
 * Meros mantig'i endi ikkita ombor tomonidan ishlatiladi: xotiradagi
 * `MultiTurnService` va bazadagi `lib/search/conversation-store.ts`.
 * Shuning uchun u sof funksiya sifatida alohida tekshiriladi — bazasiz.
 */
describe("deriveConversationContext (ikkala ombor uchun umumiy mantiq)", () => {
  it("bo'sh ro'yxat uchun kontekst bermaydi", () => {
    assert.strictEqual(deriveConversationContext([]), undefined);
  });

  it("eng YANGI qiymat ustun turadi", () => {
    const context = deriveConversationContext([
      { understanding: { detectedGrade: "5-sinf", extractedTopic: "kasrlar" } },
      {
        understanding: { detectedGrade: "8-sinf", extractedTopic: "kvadrat tenglamalar" },
      },
    ]);

    assert.ok(context);
    assert.strictEqual(context.previousGrade, "8-sinf");
    assert.strictEqual(context.previousTopic, "kvadrat tenglamalar");
  });

  it("yangi burilishda yo'q maydon eskisidan to'ldiriladi", () => {
    /*
      Aynan shu holat «endi buni oddiyroq tushuntir» degan savolda
      yuzaga keladi: yangi burilishda fan ham, sinf ham yo'q.
    */
    const context = deriveConversationContext([
      {
        understanding: {
          detectedSubject: "Matematika",
          detectedGrade: "8-sinf",
          extractedTopic: "kvadrat tenglamalar",
        },
      },
      { understanding: { extractedTopic: "" } },
    ]);

    assert.ok(context);
    assert.strictEqual(context.previousSubject, "Matematika");
    assert.strictEqual(context.previousGrade, "8-sinf");
    assert.strictEqual(context.previousTopic, "kvadrat tenglamalar");
  });

  it("tahlili yo'q burilish tashlab ketiladi", () => {
    const context = deriveConversationContext([
      { understanding: { detectedSubject: "Biologiya" } },
      {},
    ]);

    assert.ok(context);
    assert.strictEqual(context.previousSubject, "Biologiya");
  });
});
