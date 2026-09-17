import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrchestrationActions } from "../lib/search/orchestration";
import { understandQuery } from "../lib/search/understanding";

describe("search orchestration & handoff", () => {
  it("dars ishlanmasi so'ralganda Word action birinchi turadi va url parametrlari to'g'ri shakllanadi", () => {
    const understanding = understandQuery("7-sinf fizika Nyuton qonunlari dars ishlanmasi");
    const actions = buildOrchestrationActions(understanding);

    assert.ok(actions.length >= 2);
    assert.equal(actions[0].type, "create_lesson_plan");
    assert.ok(actions[0].url.includes("subject=Fizika"));
    assert.ok(actions[0].url.includes("grade=7-sinf"));
  });

  it("slaydlar so'ralganda Prezentatsiya action birinchi turadi", () => {
    const understanding = understandQuery("8-sinf biologiya hujayra slaydlar");
    const actions = buildOrchestrationActions(understanding);

    assert.equal(actions[0].type, "create_presentation");
    assert.ok(actions[0].url.includes("subject=Biologiya"));
  });
});
