import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cyrillicToLatin,
  isCyrillicText,
  normalizeApostrophes,
  normalizeGrades,
  normalizeQuery,
} from "../lib/search/normalization";

describe("search normalization — apostroflar", () => {
  it("har xil apostrof belgilarini yagona standartga keltiradi", () => {
    assert.equal(normalizeApostrophes("o‘qituvchi"), "o'qituvchi");
    assert.equal(normalizeApostrophes("oʻqituvchi"), "o'qituvchi");
    assert.equal(normalizeApostrophes("o`qituvchi"), "o'qituvchi");
    assert.equal(normalizeApostrophes("g‘oz"), "g'oz");
    assert.equal(normalizeApostrophes("gʻoz"), "g'oz");
  });
});

describe("search normalization — kirillcha o'zbek tili", () => {
  it("kirillcha yozilgan o'zbek so'zlarini lotinga to'g'ri o'tkazadi", () => {
    assert.equal(cyrillicToLatin("ўқитувчи"), "o'qituvchi");
    assert.equal(cyrillicToLatin("математика"), "matematika");
    assert.equal(cyrillicToLatin("дарс ишланма"), "dars ishlanma");
    assert.equal(cyrillicToLatin("фотосинтез"), "fotosintez");
  });

  it("kirill matnini aniqlaydi", () => {
    assert.equal(isCyrillicText("математика"), true);
    assert.equal(isCyrillicText("matematika"), false);
  });
});

describe("search normalization — sinf ifodalari", () => {
  it("sinf ifodalarini 7-sinf standart shakliga keltiradi", () => {
    assert.equal(normalizeGrades("7 sinf"), "7-sinf");
    assert.equal(normalizeGrades("7sinf"), "7-sinf");
    assert.equal(normalizeGrades("8-синф"), "8-sinf");
    assert.equal(normalizeGrades("11 sinf matematika"), "11-sinf matematika");
  });
});

describe("search normalization — typo va umumiy tozalash", () => {
  it("pedagogik va faniy typolarni to'g'rilaydi", () => {
    const q1 = normalizeQuery("matimatikadan 7 sinf kasirlar mavzusi");
    assert.equal(q1.normalized, "matematikadan 7-sinf kasrlar mavzusi");
    assert.ok(q1.corrections.length >= 2);

    const q2 = normalizeQuery("fatasintezni tushuntir");
    assert.equal(q2.normalized, "fotosintezni tushuntir");

    const q3 = normalizeQuery("prizintatsiya tayyorlash");
    assert.equal(q3.normalized, "prezentatsiya tayyorlash");
  });

  it("asl va tozalangan so'rovlarni saqlaydi", () => {
    const res = normalizeQuery("  Oʻqituvchi uchun 5 sinf  ");
    assert.equal(res.original, "Oʻqituvchi uchun 5 sinf");
    assert.equal(res.normalized, "o'qituvchi uchun 5-sinf");
  });
});
