import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { understandQuery, type ConversationTurnContext } from "../lib/search/understanding";

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
    const turn2 = understandQuery("5-sinf uchun", undefined, undefined, undefined, contextAfterTurn1);
    assert.equal(turn2.detectedGrade, "5-sinf");
    assert.equal(turn2.detectedSubject, "Biologiya", "Kontekstdan fan (Biologiya) meros qilib olinishi shart");
    assert.equal(turn2.extractedTopic, turn1.extractedTopic, "Kontekstdan mavzu (Fotosintez) meros qilib olinishi shart");

    const contextAfterTurn2: ConversationTurnContext = {
      previousTopic: turn2.extractedTopic,
      previousSubject: turn2.detectedSubject,
      previousGrade: turn2.detectedGrade,
      previousLanguage: turn2.detectedLanguage,
      previousIntent: turn2.detectedIntent,
    };

    // 3-qadam: Foydalanuvchi yangi intent so'raydi: "Endi 10 ta test qil"
    const turn3 = understandQuery("Endi 10 ta test qil", undefined, undefined, undefined, contextAfterTurn2);
    assert.equal(turn3.detectedIntent, "quiz_test", "Intent quiz_test ga yangilanishi shart");
    assert.equal(turn3.detectedGrade, "5-sinf", "Sinf (5-sinf) avvalgi kontekstdan saqlanishi shart");
    assert.equal(turn3.detectedSubject, "Biologiya", "Fan (Biologiya) avvalgi kontekstdan saqlanishi shart");
    assert.equal(turn3.extractedTopic, turn1.extractedTopic, "Mavzu (Fotosintez) saqlanishi shart");
  });

  it("agar foydalanuvchi yangi mavzuni aniq bersa, eski kontekst ustiga yoziladi", () => {
    const context: ConversationTurnContext = {
      previousTopic: "Fotosintez",
      previousSubject: "Biologiya",
      previousGrade: "6-sinf",
      previousLanguage: "UZ",
    };

    const newQuery = understandQuery("8-sinf algebra kvadrat tenglamalar", undefined, undefined, undefined, context);
    assert.equal(newQuery.detectedSubject, "Matematika", "Yangi so'rovdagi fan eski fanni almashtirishi kerak");
    assert.equal(newQuery.detectedGrade, "8-sinf", "Yangi sinf o'rnatilishi kerak");
    assert.equal(newQuery.extractedTopic.toLowerCase().includes("kvadrat tenglamalar"), true);
  });
});
