import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOfficiallyVerified } from "../lib/search/validator";

/*
  UI va backend "tasdiqlangan" holatini BIR XIL tushunishi kerak.

  V4 regressiyasi: yuqoridagi banner `isGrounded` ni tekshirardi, pastdagi
  «Rasmiy o'quv dasturi (DTS)» kartasi esa shunchaki moslar soni > 0 ni.
  Natijada tasdiqlanmagan javobda ham yashil belgili rasmiy manba kartasi
  ko'rinardi.
*/
describe("grounding holati — UI bilan yagona manba", () => {
  it("asoslangan va ehtiyotsiz javob TASDIQLANGAN", () => {
    assert.equal(isOfficiallyVerified({ isGrounded: true, isAbstained: false }, 3), true);
  });

  it("moslar bo'lsa ham, asoslanmagan javob TASDIQLANMAGAN", () => {
    assert.equal(
      isOfficiallyVerified({ isGrounded: false, isAbstained: false }, 3),
      false,
    );
  });

  it("ehtiyot rejimidagi javob moslar bilan ham TASDIQLANMAGAN", () => {
    assert.equal(isOfficiallyVerified({ isGrounded: true, isAbstained: true }, 5), false);
  });

  it("mos topilmagan bo'lsa TASDIQLANMAGAN", () => {
    assert.equal(
      isOfficiallyVerified({ isGrounded: true, isAbstained: false }, 0),
      false,
    );
  });

  it("grounding ma'lumoti umuman bo'lmasa TASDIQLANMAGAN", () => {
    assert.equal(isOfficiallyVerified(undefined, 5), false);
  });
});
