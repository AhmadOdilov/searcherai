import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * O'quv dasturi ma'lumot fayllari sinovlari.
 *
 * ── Nega bu sinovlar kerak ────────────────────────────────────────────────
 * Bu fayllar PDF'dan YARIM AVTOMATIK ajratilgan, ya'ni ularda xato
 * bo'lishi tabiiy: bo'sh bo'lim nomi, manfiy soat, sahifa raqami
 * mavzu bo'lib tushib qolishi. Bunday xato bazaga, undan esa AI
 * promptiga o'tib ketardi va o'qituvchi soxta "rasmiy ma'lumot"
 * olardi.
 *
 * Sinov yangi fan-sinf qo'shilganda ham avtomatik ishlaydi — qo'lda
 * hech narsa qo'shish kerak emas.
 */

const DATA_DIR = path.join(process.cwd(), "data", "curriculum");

interface Topic {
  topicName: string;
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
}

interface File {
  subject: string;
  grade: string;
  source: string;
  topics: Topic[];
}

const files = readdirSync(DATA_DIR).filter((name) => name.endsWith(".json"));

function load(name: string): File {
  return JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8")) as File;
}

describe("o'quv dasturi ma'lumot fayllari", () => {
  it("kamida bitta fayl bor", () => {
    assert.ok(files.length > 0, "data/curriculum bo'sh");
  });

  for (const name of files) {
    describe(name, () => {
      const data = load(name);

      it("fan va sinf to'ldirilgan", () => {
        assert.ok(data.subject.trim().length >= 2);
        assert.match(
          data.grade,
          /^\d{1,2}-sinf$/,
          `sinf shakli noto'g'ri: ${data.grade}`,
        );
      });

      it("manba havolasi RASMIY domenda", () => {
        // Manba yo'qolsa, ma'lumot qayerdan kelgani bilinmay qoladi.
        assert.match(
          data.source,
          /^https:\/\/uzbmb\.uz\//,
          `manba shubhali: ${data.source}`,
        );
      });

      it("mavzular bo'sh emas", () => {
        assert.ok(data.topics.length >= 3, `juda kam bo'lim: ${data.topics.length}`);
      });

      it("har bir bo'lim nomi ma'noli", () => {
        for (const topic of data.topics) {
          assert.ok(
            topic.topicName.trim().length >= 4,
            `juda qisqa nom: "${topic.topicName}"`,
          );
          // Sahifa raqami yoki yolg'iz son mavzu bo'la olmaydi.
          assert.ok(
            !/^\d+$/.test(topic.topicName.trim()),
            `mavzu o'rniga raqam: "${topic.topicName}"`,
          );
        }
      });

      it("soatlar oqilona chegarada", () => {
        for (const topic of data.topics) {
          if (topic.expectedHours === null) continue;
          assert.ok(
            topic.expectedHours > 0 && topic.expectedHours <= 120,
            `g'alati soat: ${topic.topicName} — ${topic.expectedHours}`,
          );
        }
      });

      it("yillik soat yig'indisi haqiqatga yaqin", () => {
        /*
          Bir o'quv yili ~34 hafta. Haftasiga 1-6 soat — ya'ni yiliga
          34-204 soat. Bundan tashqarisi ajratishda xato bo'lganini
          bildiradi (masalan ikkita sinf matni aralashib ketgan).
        */
        const total = data.topics.reduce(
          (sum, topic) => sum + (topic.expectedHours ?? 0),
          0,
        );
        assert.ok(total >= 30 && total <= 220, `yillik soat g'alati: ${total}`);
      });

      it("bo'lim nomlari TAKRORLANMAYDI", () => {
        // Takror nom — ajratish ikki marta o'qiganini bildiradi.
        const names = data.topics.map((topic) => topic.topicName.toLowerCase());
        assert.equal(new Set(names).size, names.length, "takrorlangan bo'lim nomi bor");
      });
    });
  }
});
