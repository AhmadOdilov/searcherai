import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCurriculumProvenance, buildProvenanceTrace } from "../lib/curriculum/provenance";

/*
  V4 da har bir dalilga `DTS-UZBMB-2025-v1` / 2025 qattiq yozilgan edi,
  holbuki bazadagi 9-sinf matematika dasturi qabul2026 hujjatidan olingan.
  Ya'ni tizim 2026-yilgi hujjatni 2025-yil versiyasi deb iqtibos keltirardi.
*/
describe("o'quv dasturi provenansi manbadan aniqlanadi", () => {
  it("2025-yil hujjati uchun 2025 versiyasi", () => {
    const p = deriveCurriculumProvenance(
      "https://uzbmb.uz/upload/file/pdf/qabul2025/dasturlar/5.Matematika/8-sinf.pdf",
    );
    assert.equal(p.sourceVersion, "DTS-UZBMB-2025-v1");
    assert.equal(p.curriculumYear, 2025);
  });

  it("2026-yil hujjati 2025 deb belgilanmaydi", () => {
    const p = deriveCurriculumProvenance(
      "https://uzbmb.uz/upload/file/pdf/qabul2026/dasturlar/9/matematika/9.pdf",
    );
    assert.equal(p.sourceVersion, "DTS-UZBMB-2026-v1");
    assert.equal(p.curriculumYear, 2026);
  });

  it("yilni aniqlab bo'lmasa — yil UYDIRILMAYDI", () => {
    const p = deriveCurriculumProvenance("https://example.org/dastur.pdf");
    assert.equal(p.sourceVersion, "DTS-UZBMB-UNKNOWN");
    assert.equal(p.curriculumYear, undefined);
  });

  it("bo'sh manba ham xato bermaydi", () => {
    const p = deriveCurriculumProvenance("");
    assert.equal(p.curriculumYear, undefined);
  });

  it("provenans bayonotida noma'lum yil ko'rsatilmaydi", () => {
    const trace = buildProvenanceTrace({
      id: "dts_abc",
      subject: "Matematika",
      grade: "9-sinf",
      topicName: "TRIGONOMETRIYA ELEMENTLARI",
      source: "https://example.org/dastur.pdf",
    });
    assert.equal(trace.curriculumYear, undefined);
    assert.equal(trace.provenanceStatement.includes("yil:"), false);
  });
});
