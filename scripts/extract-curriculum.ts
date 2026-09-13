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
 * Mavzu darajasidagi sarlavha: "1-mavzu. Nutq madaniyati (1 soat)".
 *
 * ── Nega ikkinchi naqsh kerak ────────────────────────────────────────────
 * Hujjatlar BIR XIL emas. Ko'pchiligi bob darajasida tuzilgan
 * ("I BOB. ODDIY KASRLAR — 29 soat"), lekin yuqori sinf Ona tili
 * dasturlari to'g'ridan-to'g'ri darslar ro'yxatini beradi
 * ("1-mavzu ... 1 soat"). Ikkinchi naqshsiz bunday hujjatdan BITTA
 * ham bo'lim ajratib bo'lmasdi (Ona tili 11-sinf shunday chiqdi).
 *
 * "4- 5-mavzular." kabi bir nechta dars birga berilgan holat ham bor.
 */
const TOPIC_RE = /^\s*(\d+(?:\s*[-–]\s*\d+)?)\s*[-–]?\s*mavzu(?:lar)?\.?\s*(.+?)\s*$/i;

/**
 * Soatlar qatori: "(19 soat)", "(8 soat, A2+: 1 soat)" yoki "( 35 soat)".
 *
 * Qavsdan keyingi bo'shliq ATAYLAB ruxsat etilgan: Matematika 8-sinf
 * hujjatida u bor va busiz bobning 35 soati umuman topilmagan edi.
 *
 * BIRINCHI son olinadi — u asosiy (A2) daraja. A2+ kengaytirilgan
 * dastur uchun va uni alohida maydonga solish pilot uchun ortiqcha.
 */
const HOURS_RE = /\(\s*(\d+)\s*soat/i;

/**
 * Sarlavha matnini tozalaydi.
 *
 * Ikkala yo'lda ham chaqiriladi: bir qatorli sarlavhada ham,
 * ikki qatordan birlashtirilganda ham.
 */
function cleanName(value: string): string {
  return (
    value
      // To'liq qavs: "Nutq madaniyati (1 soat, B1+:1soat)"
      .replace(/\([^)]*soat[^)]*\)\s*\.?\s*$/i, "")
      /*
      YOPILMAGAN qavs: PDF'da qator o'rtasidan bo'linganda
      "... (2 soat," shaklida qolib ketadi va yopilishi keyingi
      qatorga tushadi. Busiz nom ichida qavs qoldig'i qolardi.
    */
      .replace(/\([^)]*soat[^)]*$/i, "")
      /*
      PDF qator oxirida so'zni chiziqcha bilan bo'ladi:
      "UCHBURCHAK ... ORA- SIDAGI MUNOSABATLAR". Matnga aylantirilgach
      chiziqcha va bo'shliq qolib ketadi — ularni birlashtiramiz.
      Faqat HARF-chiziqcha-BO'SHLIQ-HARF holati: "o'quv-tarbiya" kabi
      haqiqiy qo'shma so'zlarga tegilmaydi (ularda bo'shliq yo'q).
    */
      .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
      .replace(/\s+/g, " ")
      .trim()
  );
}

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

  /*
    ── Ikki o'tishli: BOB darajasi USTUN ──────────────────────────────────
    Ba'zi hujjatlarda IKKALA daraja ham bor: "I BOB ... (19 soat)" va
    uning ichida "1-2-mavzular: ... (2 soat)". Ikkalasini birga olsak,
    soatlar IKKI MARTA sanaladi (bobning 19 soati + ichidagi mavzularning
    yig'indisi yana 19) va jadval ma'nosiz bo'lardi.

    Shuning uchun: agar hujjatda birorta bob bo'lsa — faqat boblar
    olinadi. Boblar umuman bo'lmagandagina (yuqori sinf Ona tili
    dasturlari shunday) mavzu darajasiga tushiladi.
  */
  const hasChapters = lines.some((line) => SECTION_RE.test(line));

  const sectionStarts: Array<{ index: number; name: string }> = [];

  for (const [index, line] of lines.entries()) {
    const sectionMatch = SECTION_RE.exec(line);
    const topicMatch = hasChapters || sectionMatch !== null ? null : TOPIC_RE.exec(line);
    const match = sectionMatch ?? topicMatch;
    if (match === null) continue;

    const rawName = sectionMatch === null ? match[2]! : match[3]!;

    /*
      Mavzu shaklida soat AYNAN sarlavha qatorida turadi
      ("Nutq madaniyati (1 soat, B1+:1soat)") — uni nomdan ajratamiz,
      aks holda nom ichida qavs qolib ketardi.
    */
    const name = cleanName(rawName);
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
    // Sarlavha qatorining O'ZI ham tekshiriladi: mavzu shaklida soat
    // aynan shu yerda turadi.
    const lookahead = lines.slice(index, index + 4);
    const hasHours = lookahead.some((next) => HOURS_RE.test(next));

    const letters = name.replace(/[^\p{L}]/gu, "");
    const upperRatio =
      letters.length === 0
        ? 0
        : [...letters].filter((char) => char === char.toUpperCase()).length /
          letters.length;

    if (!hasHours && upperRatio < 0.6) continue;

    /*
      ── Ikki qatorga bo'lingan sarlavha ────────────────────────────────
      PDF'da uzun bob nomi keyingi qatorga o'tadi:
        "VII BOB. MUSBAT VA MANFIY SONLARNI KO'PAYTIRISH VA"
        "BO'LISH"
      Faqat birinchi qatorni olsak, nom yarim qoladi va AI promptiga
      shunday tushadi. Keyingi qator ham BOSH HARFLAR bilan bo'lsa va
      unda soat ham, yangi sarlavha ham bo'lmasa — u davomi deb
      qo'shiladi.
    */
    const next = lines[index + 1];
    if (next !== undefined) {
      const trimmed = next.trim();
      const nextLetters = trimmed.replace(/[^\p{L}]/gu, "");
      const nextUpper =
        nextLetters.length === 0
          ? 0
          : [...nextLetters].filter((char) => char === char.toUpperCase()).length /
            nextLetters.length;

      const isContinuation =
        trimmed.length > 0 &&
        trimmed.length < 60 &&
        nextLetters.length >= 3 &&
        nextUpper >= 0.8 &&
        !HOURS_RE.test(trimmed) &&
        !SECTION_RE.test(next);

      if (isContinuation) {
        // Tozalash BIRLASHTIRGANDAN KEYIN: chiziqcha bilan bo'lingan
        // so'z aynan ikki qator CHEGARASIDA bo'ladi, ya'ni birinchi
        // qatorni alohida tozalash uni tutmaydi.
        sectionStarts.push({ index, name: cleanName(`${name} ${trimmed}`) });
        continue;
      }
    }

    sectionStarts.push({ index, name });
  }

  const outcomes =
    sectionStarts.length > 0 ? extractOutcomes(lines, sectionStarts[0]!.index) : [];

  const topics: ExtractedTopic[] = sectionStarts.map((section, position) => {
    const end = sectionStarts[position + 1]?.index ?? lines.length;
    const body = lines.slice(section.index + 1, end);

    // Soat sarlavha qatorida YOKI undan keyingi 1-3 qatorda turadi.
    const hoursLine = [lines[section.index]!, ...body.slice(0, 3)].find((line) =>
      HOURS_RE.test(line),
    );
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
