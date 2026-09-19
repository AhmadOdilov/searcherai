import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  understandQuery,
  type ConversationTurnContext,
} from "../lib/search/understanding";

describe("search multi-turn context resolution (Phase 14)", () => {
  it("ketma-ket suhbat qadamlarida mavzu, fan va sinfni to'g'ri meros qilib oladi", () => {
    // 1-qadam: Boshlang'ich savol
    const turn1 = understandQuery("Fotosintez nima?");
    assert.equal(turn1.detectedSubject, "Biologiya");
    assert.equal(turn1.extractedTopic.toLowerCase().includes("fotosintez"), true);
    assert.equal(turn1.detectedIntent, "definition");

    // Suhbat konteksti (backend context turn 1 dan turn 2 ga)
    const contextAfterTurn1: ConversationTurnContext = {
      previousTopic: turn1.extractedTopic,
      previousSubject: turn1.detectedSubject,
      previousGrade: turn1.detectedGrade,
      previousLanguage: turn1.detectedLanguage,
      previousIntent: turn1.detectedIntent,
    };

    // 2-qadam: Foydalanuvchi faqat sinfni aytadi: "5-sinf uchun"
    const turn2 = understandQuery(
      "5-sinf uchun",
      undefined,
      undefined,
      undefined,
      contextAfterTurn1,
    );
    assert.equal(turn2.detectedGrade, "5-sinf");
    assert.equal(
      turn2.detectedSubject,
      "Biologiya",
      "Kontekstdan fan (Biologiya) meros qilib olinishi shart",
    );
    assert.equal(
      turn2.extractedTopic,
      turn1.extractedTopic,
      "Kontekstdan mavzu (Fotosintez) meros qilib olinishi shart",
    );

    const contextAfterTurn2: ConversationTurnContext = {
      previousTopic: turn2.extractedTopic,
      previousSubject: turn2.detectedSubject,
      previousGrade: turn2.detectedGrade,
      previousLanguage: turn2.detectedLanguage,
      previousIntent: turn2.detectedIntent,
    };

    // 3-qadam: Foydalanuvchi yangi intent so'raydi: "Endi 10 ta test qil"
    const turn3 = understandQuery(
      "Endi 10 ta test qil",
      undefined,
      undefined,
      undefined,
      contextAfterTurn2,
    );
    assert.equal(
      turn3.detectedIntent,
      "quiz_test",
      "Intent quiz_test ga yangilanishi shart",
    );
    assert.equal(
      turn3.detectedGrade,
      "5-sinf",
      "Sinf (5-sinf) avvalgi kontekstdan saqlanishi shart",
    );
    assert.equal(
      turn3.detectedSubject,
      "Biologiya",
      "Fan (Biologiya) avvalgi kontekstdan saqlanishi shart",
    );
    assert.equal(
      turn3.extractedTopic,
      turn1.extractedTopic,
      "Mavzu (Fotosintez) saqlanishi shart",
    );

    const contextAfterTurn3: ConversationTurnContext = {
      previousTopic: turn3.extractedTopic,
      previousSubject: turn3.detectedSubject,
      previousGrade: turn3.detectedGrade,
      previousLanguage: turn3.detectedLanguage,
      previousIntent: turn3.detectedIntent,
    };

    // 4-qadam: "Javoblarini ham ber"
    const turn4 = understandQuery(
      "Javoblarini ham ber",
      undefined,
      undefined,
      undefined,
      contextAfterTurn3,
    );
    assert.equal(turn4.detectedGrade, "5-sinf", "Sinf 4-qadamda saqlanishi shart");
    assert.equal(turn4.detectedSubject, "Biologiya", "Fan 4-qadamda saqlanishi shart");
    assert.equal(
      turn4.extractedTopic,
      turn1.extractedTopic,
      "Mavzu 4-qadamda saqlanishi shart",
    );

    const contextAfterTurn4: ConversationTurnContext = {
      previousTopic: turn4.extractedTopic,
      previousSubject: turn4.detectedSubject,
      previousGrade: turn4.detectedGrade,
      previousLanguage: turn4.detectedLanguage,
      previousIntent: turn4.detectedIntent,
    };

    // 5-qadam: "Endi o'qituvchi uchun dars reja qil"
    const turn5 = understandQuery(
      "Endi o'qituvchi uchun dars reja qil",
      undefined,
      undefined,
      undefined,
      contextAfterTurn4,
    );
    assert.equal(
      turn5.detectedIntent,
      "lesson_plan",
      "Intent lesson_plan ga o'tishi kerak",
    );
    assert.equal(turn5.audience, "teacher", "Auditoriya teacher bo'lishi kerak");
    assert.equal(turn5.detectedGrade, "5-sinf", "Sinf 5-qadamda saqlanishi shart");
    assert.equal(turn5.detectedSubject, "Biologiya", "Fan 5-qadamda saqlanishi shart");
    assert.equal(
      turn5.extractedTopic,
      turn1.extractedTopic,
      "Mavzu 5-qadamda saqlanishi shart",
    );
  });

  it("seans qayta ishga tushganda (session reset/restart) eski kontekst tozalanadi", () => {
    // Tozalangan yangi seans (context yo'q)
    const freshTurn = understandQuery("Ona tili fe'l so'z turkumi");
    assert.equal(freshTurn.detectedSubject, "Ona tili");
    assert.equal(freshTurn.extractedTopic.toLowerCase().includes("fe'l"), true);
  });

  it("agar foydalanuvchi yangi mavzuni aniq bersa, eski kontekst ustiga yoziladi", () => {
    const context: ConversationTurnContext = {
      previousTopic: "Fotosintez",
      previousSubject: "Biologiya",
      previousGrade: "6-sinf",
      previousLanguage: "UZ",
    };

    const newQuery = understandQuery(
      "8-sinf algebra kvadrat tenglamalar",
      undefined,
      undefined,
      undefined,
      context,
    );
    assert.equal(
      newQuery.detectedSubject,
      "Matematika",
      "Yangi so'rovdagi fan eski fanni almashtirishi kerak",
    );
    assert.equal(newQuery.detectedGrade, "8-sinf", "Yangi sinf o'rnatilishi kerak");
    assert.equal(
      newQuery.extractedTopic.toLowerCase().includes("kvadrat tenglamalar"),
      true,
    );
  });
});
