/**
 * O'quv dasturi PDF'idan mavzular jadvalini ajratib oladi.
 *
 * Ishlatish:
 *   pdftotext -layout -enc UTF-8 dastur.pdf dastur.txt
 *   npx tsx scripts/extract-curriculum.ts dastur.txt Matematika 5 > data/curriculum/matematika-5.json
 *
 * ── Bu skript BIR MARTALIK va YARIM AVTOMATIK ─────────────────────────────
 * U ilova ishlashida qatnashmaydi — faqat yangi fan-sinf qo'shilganda
 * ishlatiladi. Natija JSON fayl bo'lib, u ODAM TOMONIDAN ko'rib
 * chiqiladi va keyin `seed-curriculum.ts` bazaga yozadi.
 *
 * Nega to'g'ridan-to'g'ri bazaga yozmaydi: PDF'dan matn ajratish hech
 * qachon 100% aniq bo'lmaydi (sahifa raqamlari, bo'lingan so'zlar,
 * jadval chegaralari aralashadi). Oraliq JSON bo'lsa — xatoni ko'rib,
 * qo'lda tuzatib, keyin yuklash mumkin. Bazaga to'g'ridan-to'g'ri
 * yozilsa, xato jim o'tib ketardi va AI promptiga tushardi.
 *
 * ── `pdftotext` kerak ─────────────────────────────────────────────────────
 * macOS:  brew install poppler
 * Ubuntu: sudo apt install poppler-utils
 */

import { readFileSync } from "node:fs";

/** Chiqadigan JSON shakli — `seed-curriculum.ts` shuni kutadi. */
interface ExtractedTopic {
  topicName: string;
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
}

interface ExtractedCurriculum {
  subject: string;
  grade: string;
  /** Hujjat qayerdan olingani — manbani yo'qotmaslik uchun. */
  source: string;
  topics: ExtractedTopic[];
}

/**
 * Bob/bo'lim sarlavhasi.
 *
 * Ikki shakl uchraydi:
 *   "I BOB. NATURAL SONLARNI QO'SHISH VA AYIRISH"
 *   "1-BO‘LIM. KIRISH. TAKRORLASH."
 */
const SECTION_RE = /^\s*\.?\s*([IVXLC]+|\d+)[-\s]*(BOB|BO['‘’`]LIM)\.?\s*(.+?)\s*$/i;

/**
 * Soatlar qatori: "(19 soat)" yoki "(8 soat, A2+: 1 soat)".
 *
 * BIRINCHI son olinadi — u asosiy (A2) daraja. A2+ kengaytirilgan
 * dastur uchun va uni alohida maydonga solish pilot uchun ortiqcha.
 */
const HOURS_RE = /\((\d+)\s*soat/i;

/** Sahifa raqami yoki bo'sh qator — mazmunga kirmaydi. */
function isNoise(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || /^\d{1,3}$/.test(trimmed);
}

/**
 * Kutilayotgan natijalar — "... oladi", "... biladi" bilan tugaydigan
 * jumlalar.
 *
 * Ular hujjatning boshida, boblardan OLDIN turadi va o'quvchi nima
 * qila olishi kerakligini aytadi. Aynan shu narsa dars ishlanmasining
 * "kutilayotgan natijalar" bo'limiga mos keladi.
 */
function extractOutcomes(lines: string[], firstSectionIndex: number): string[] {
  const head = lines.slice(0, firstSectionIndex).join(" ").replace(/\s+/g, " ");

  /*
    Ikki xil yozilish uchraydi va ikkalasini ham tutish kerak:
      · matematikada — nuqtali vergul bilan ajratilgan ro'yxat
        ("... topa oladi; ... biladi;")
      · ona tilida — chiziqcha bilan boshlanadigan qatorlar
        ("– matndan zarur ma'lumotlarni izlab topa olish")
    Shuning uchun avval chiziqchalar bo'yicha, so'ng nuqtali vergul
    bo'yicha bo'lamiz.
  */
  return head
    .split(/[;–—]|(?:^|\s)[-•]\s/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 25 &&
        part.length < 300 &&
        /\b(oladi|olish|biladi|bilish|qo['‘’]lla|tushuna|ajrat|foydalan|shakllantir)/i.test(
          part,
        ),
    )
    .map((part) => part.replace(/^[-–—•\s]+/, "").replace(/\s+/g, " "))
    .slice(0, 8);
}

function extract(
  text: string,
  subject: string,
  grade: string,
  source: string,
): ExtractedCurriculum {
  const lines = text.split("\n");

  const sectionStarts: Array<{ index: number; name: string }> = [];
  for (const [index, line] of lines.entries()) {
    const match = SECTION_RE.exec(line);
    if (match === null) continue;

    const name = match[3]!.replace(/\s+/g, " ").trim();
    // Juda qisqa "sarlavha" — katta ehtimol noto'g'ri tanilgan qator.
    if (name.length < 4) continue;

    /*
      ── Soxta sarlavhalarni filtrlaymiz ────────────────────────────────
      Dastur matnida "I bobni takrorlashga doir masalalar" kabi ODDIY
      JUMLALAR ham bor va ular "I BOB" naqshiga tushadi. Ularni bobga
      aylantirsak, jadvalda 15 ta emas, 30 ta "bob" paydo bo'lardi va
      yarmi ma'nosiz bo'lardi.

      Haqiqiy sarlavhaning ikki belgisi bor:
        · keyingi 1-3 qatorda soat ko'rsatilgan, YOKI
        · sarlavha BOSH HARFLAR bilan yozilgan.
      Ikkalasi ham bo'lmasa — bu jumla, sarlavha emas.
    */
    const lookahead = lines.slice(index + 1, index + 4);
    const hasHours = lookahead.some((next) => HOURS_RE.test(next));

    const letters = name.replace(/[^\p{L}]/gu, "");
    const upperRatio =
      letters.length === 0
        ? 0
        : [...letters].filter((char) => char === char.toUpperCase()).length /
          letters.length;

    if (!hasHours && upperRatio < 0.6) continue;

    sectionStarts.push({ index, name });
  }

  const outcomes =
    sectionStarts.length > 0 ? extractOutcomes(lines, sectionStarts[0]!.index) : [];

  const topics: ExtractedTopic[] = sectionStarts.map((section, position) => {
    const end = sectionStarts[position + 1]?.index ?? lines.length;
    const body = lines.slice(section.index + 1, end);

    // Soat sarlavhadan keyingi 1-3 qatorda turadi.
    const hoursLine = body.slice(0, 3).find((line) => HOURS_RE.test(line));
    const hoursMatch = hoursLine === undefined ? null : HOURS_RE.exec(hoursLine);

    const description = body
      .filter((line) => !isNoise(line) && !HOURS_RE.test(line))
      .map((line) => line.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      topicName: section.name,
      description,
      expectedHours: hoursMatch === null ? null : Number(hoursMatch[1]),
      // Natijalar butun hujjat uchun umumiy — har bir bobga nusxalanadi,
      // chunki dastur ularni bob darajasida ajratmaydi.
      expectedOutcomes: outcomes,
    };
  });

  return { subject, grade, source, topics };
}

// ─── Ishga tushirish ─────────────────────────────────────────────────────────

const [, , file, subject, gradeNumber, source] = process.argv;

if (file === undefined || subject === undefined || gradeNumber === undefined) {
  console.error(
    "Ishlatish: npx tsx scripts/extract-curriculum.ts <matn.txt> <Fan> <sinf> [manba-havolasi]",
  );
  process.exit(1);
}

const result = extract(
  readFileSync(file, "utf8"),
  subject,
  `${gradeNumber}-sinf`,
  source ?? "",
);

console.log(JSON.stringify(result, null, 2));
