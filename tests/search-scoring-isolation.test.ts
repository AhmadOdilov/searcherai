import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/*
  V6 PHASE 5 — `lib/search/scoring.ts` ishlab chiqarish quvurida
  ISHLATILMASLIGI qulflanadi.

  Nega: V4 gacha `tests/search-scoring.test.ts` reyting sifatini
  tekshiryapmiz deb o'ylanardi, aslida esa u quvurda chaqirilmaydigan
  funksiyani tekshirardi. Production reranker'ning o'zi qoplanmagan edi —
  aynan shu sabab undagi tautologik shart (har qanday nomzodga exact=0.85)
  sezilmay qolgan.

  Bu test ikki yo'nalishda himoya qiladi:
    · scoring.ts jimgina quvurga qaytib kirmasligi;
    · agar u ataylab ulansa, test yiqilib, reranker testlarini
      yangilash kerakligini eslatishi.
*/

const SEARCH_DIR = path.join(process.cwd(), "lib", "search");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("scoring.ts — quvurdan ajratilgan", () => {
  it("lib/search ichidagi hech bir modul scoring.ts ni import qilmaydi", () => {
    const offenders: string[] = [];

    for (const file of collectTsFiles(SEARCH_DIR)) {
      if (path.basename(file) === "scoring.ts") continue;
      const source = readFileSync(file, "utf8");
      if (/from\s+["'][^"']*\/scoring["']|from\s+["']\.\/scoring["']/.test(source)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `scoring.ts quvurga ulangan: ${offenders.join(", ")}. ` +
        "Agar bu ataylab bo'lsa, production reyting testlarini yangilang.",
    );
  });

  it("lib/api va app qatlamlari ham scoring.ts ga bog'lanmagan", () => {
    const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
    const offenders: string[] = [];

    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const source = readFileSync(file, "utf8");
        if (/search\/scoring/.test(source))
          offenders.push(path.relative(process.cwd(), file));
      }
    }

    assert.deepEqual(offenders, []);
  });
});
