/**
 * V5 ko'p bosqichli suhbat (multi-turn) baholashi — §5.
 *
 * Nimani tekshiradi: 1-bosqichda berilgan fan/sinf/mavzu keyingi
 * bosqichlarda ("10 ta test qil", "javoblarini ham ber", "qisqartir")
 * SAQLANADIMI, va modifikatorlar intent/auditoriyani to'g'ri
 * yangilaydimi.
 *
 * Kontekst `MultiTurnService` orqali olinadi — ya'ni testdagi soxta
 * kontekst emas, mahsulotdagi haqiqiy servis.
 *
 * ── MUHIM CHEKLOV (halol aytilishi shart) ─────────────────────────────────
 * `MultiTurnService` hozircha HECH QAYSI API yo'nalishiga ulanmagan:
 * `POST /api/search` `runSearch(input)` ni kontekstsiz chaqiradi va
 * `SearchConversation` / `SearchMessage` jadvallari (migratsiyasi bor)
 * hech qayerda o'qilmaydi ham, yozilmaydi ham. Ya'ni bu skript kutubxona
 * qatlamining to'g'riligini isbotlaydi, mahsulotda ko'p bosqichli suhbat
 * ishlayotganini EMAS.
 */

import fs from "fs";
import path from "path";
import {
  understandQuery,
  type SearchIntent,
  type AudienceMode,
} from "../lib/search/understanding";
import { MultiTurnService } from "../lib/search/multi-turn-service";

interface MultiTurnItem {
  id: string;
  q: string;
  turns: Array<{
    q: string;
    expectedSubject?: string;
    expectedGrade?: string;
    expectedIntent?: SearchIntent;
    expectedAudience?: AudienceMode;
    expectedTopicContains?: string;
  }>;
}

/** Apostrof variantlarini birxillashtirish (U+02BB, U+2019 va h.k. -> U+0027). */
function normalizeApostrophes(value: string): string {
  return value.replace(/['\u2018\u2019\u02BB\u02BC\u0060]/g, "'").toLowerCase();
}

/**
 * Mavzu saqlanishini o'ZAK darajasida tekshirish.
 *
 * Dvigatel ba'zi atamalarni ATAYLAB kanonik shaklga keltiradi
 * («trigonometrik» -> «trigonometriya»). Bu to'g'ri xatti-harakat, lekin
 * bayt darajasidagi solishtirish uni "mavzu yo'qoldi" deb belgilardi.
 *
 * Shu sababli 6 belgilik o'zak bo'yicha solishtiriladi — u «trigon…»
 * ikkala shaklga ham mos keladi, lekin butunlay boshqa mavzuni
 * o'tkazib yuborish uchun hali ham yetarlicha aniq.
 */
function topicStem(value: string): string {
  return normalizeApostrophes(value).slice(0, 6);
}

function pct(n: number, d: number): number {
  return d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0;
}

function main() {
  const root = process.cwd();
  const items: MultiTurnItem[] = JSON.parse(
    fs.readFileSync(path.join(root, "benchmark", "v5", "multi_turn.json"), "utf8"),
  );

  let turnsTotal = 0;
  let subjectKept = 0,
    subjectTotal = 0;
  let gradeKept = 0,
    gradeTotal = 0;
  let intentOk = 0,
    intentTotal = 0;
  let audienceOk = 0,
    audienceTotal = 0;
  let topicKept = 0,
    topicTotal = 0;
  const failures: Array<{ id: string; turn: number; q: string; detail: string }> = [];

  for (const item of items) {
    MultiTurnService._clearAll();
    const userId = `eval-${item.id}`;
    const thread = MultiTurnService.createThread(userId, item.q);

    item.turns.forEach((turn, index) => {
      turnsTotal++;
      const context = MultiTurnService.getContextForNextTurn(thread.id, userId);
      const u = understandQuery(turn.q, undefined, undefined, undefined, context);
      MultiTurnService.addTurn(thread.id, userId, turn.q, u);

      const fail = (detail: string) =>
        failures.push({ id: item.id, turn: index + 1, q: turn.q, detail });

      if (turn.expectedSubject) {
        subjectTotal++;
        if (u.detectedSubject?.toLowerCase() === turn.expectedSubject.toLowerCase())
          subjectKept++;
        else
          fail(`fan yo'qoldi: ${u.detectedSubject ?? "yo'q"} != ${turn.expectedSubject}`);
      }
      if (turn.expectedGrade) {
        gradeTotal++;
        if (u.detectedGrade?.toLowerCase() === turn.expectedGrade.toLowerCase())
          gradeKept++;
        else fail(`sinf yo'qoldi: ${u.detectedGrade ?? "yo'q"} != ${turn.expectedGrade}`);
      }
      if (turn.expectedIntent) {
        intentTotal++;
        if (u.detectedIntent === turn.expectedIntent) intentOk++;
        else fail(`intent: ${u.detectedIntent} != ${turn.expectedIntent}`);
      }
      if (turn.expectedAudience) {
        audienceTotal++;
        if (u.audience === turn.expectedAudience) audienceOk++;
        else fail(`auditoriya: ${u.audience} != ${turn.expectedAudience}`);
      }
      if (turn.expectedTopicContains) {
        topicTotal++;
        if (
          normalizeApostrophes(u.extractedTopic).includes(
            topicStem(turn.expectedTopicContains),
          )
        )
          topicKept++;
        else
          fail(
            `mavzu yo'qoldi: «${u.extractedTopic}» ichida «${turn.expectedTopicContains}» yo'q`,
          );
      }
    });
  }

  // Chegaralangan xotira tekshiruvi (§5): 1000 bosqich.
  MultiTurnService._clearAll();
  const stressUser = "eval-stress";
  const stressThread = MultiTurnService.createThread(
    stressUser,
    "Chegaralangan xotira testi",
  );
  for (let i = 0; i < 1000; i++) {
    MultiTurnService.addTurn(
      stressThread.id,
      stressUser,
      `Savol ${i}`,
      understandQuery(`savol ${i} matematika`),
    );
  }
  const afterStress = MultiTurnService.getThread(stressThread.id, stressUser);
  const boundedMemory = (afterStress?.turns.length ?? 0) <= 50;
  MultiTurnService._clearAll();

  const report = {
    timestamp: new Date().toISOString(),
    conversations: items.length,
    turns: turnsTotal,
    subjectRetention: {
      ok: subjectKept,
      total: subjectTotal,
      rate: pct(subjectKept, subjectTotal),
    },
    gradeRetention: {
      ok: gradeKept,
      total: gradeTotal,
      rate: pct(gradeKept, gradeTotal),
    },
    topicRetention: {
      ok: topicKept,
      total: topicTotal,
      rate: pct(topicKept, topicTotal),
    },
    intentUpdate: { ok: intentOk, total: intentTotal, rate: pct(intentOk, intentTotal) },
    audienceUpdate: {
      ok: audienceOk,
      total: audienceTotal,
      rate: pct(audienceOk, audienceTotal),
    },
    boundedMemoryAt1000Turns: boundedMemory,
    retainedTurnsAt1000: afterStress?.turns.length ?? 0,
    productionWiring: {
      apiRouteUsesConversationContext: false,
      searchConversationTablesUsed: false,
      note:
        "MultiTurnService hech qaysi API yo'nalishiga ulanmagan. Bu o'lchovlar kutubxona " +
        "qatlamiga tegishli, mahsulotdagi ishlayotgan xususiyatga emas.",
    },
    failures: failures.slice(0, 100),
    totalFailures: failures.length,
  };

  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports", "search-v5-multiturn.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log("==========================================================");
  console.log(`   V5 MULTI-TURN (${items.length} suhbat, ${turnsTotal} bosqich)`);
  console.log("==========================================================");
  console.log(
    `- Fan saqlanishi:      ${report.subjectRetention.rate}% (${subjectKept}/${subjectTotal})`,
  );
  console.log(
    `- Sinf saqlanishi:     ${report.gradeRetention.rate}% (${gradeKept}/${gradeTotal})`,
  );
  console.log(
    `- Mavzu saqlanishi:    ${report.topicRetention.rate}% (${topicKept}/${topicTotal})`,
  );
  console.log(
    `- Intent yangilanishi: ${report.intentUpdate.rate}% (${intentOk}/${intentTotal})`,
  );
  console.log(
    `- Auditoriya:          ${report.audienceUpdate.rate}% (${audienceOk}/${audienceTotal})`,
  );
  console.log(
    `- 1000 bosqichda chegaralangan xotira: ${boundedMemory ? "HA" : "YO'Q"} (${report.retainedTurnsAt1000} bosqich saqlangan)`,
  );
  console.log(`\n⚠  Ishlab chiqarishda ulanmagan: /api/search kontekstni UZATMAYDI.`);

  if (failures.length > 0) {
    console.log(`\nNosozliklar: ${failures.length}`);
    for (const f of failures.slice(0, 12)) {
      console.log(`  - ${f.id} #${f.turn} «${f.q}» — ${f.detail}`);
    }
  }
  console.log("\n✅ reports/search-v5-multiturn.json yozildi.");
}

main();
