import "server-only";
import { prisma } from "@/lib/db";
import { searchTerms } from "@/lib/curriculum/terms";
import type { QueryUnderstanding } from "./understanding";
import type { CurriculumMatch } from "@/lib/curriculum/service";
import { stemUzbekWord, getApostropheVariants } from "./normalization";
import { expandRetrievalTerms } from "./concept-map";
import { rewriteQueryForRetrieval } from "./rewrite";
import { rerankCandidates, type RerankerCandidate } from "./reranker";
import { getCurriculumCoverage, canProvideOfficialEvidence } from "@/lib/curriculum/coverage";

/**
 * Darajalangan o'quv dasturi bo'limi natijasi va to'liq manba provenansi (Phase 12).
 */
export interface RankedCurriculumMatch extends CurriculumMatch {
  sourceId: string;
  sourceVersion?: string;
  curriculumYear?: number;
  subject: string;
  grade: string;
  score: number;
  exactMatch: boolean;
  crossGradeMatch: boolean;
  isCrossGrade?: boolean;
  requestedGrade?: string;
  availableGrade?: string;
  scoreBreakdown: {
    exactMatch: number;
    semanticSimilarity: number;
    outcomeMatch: number;
    gradeSubjectMatch: number;
    intentMatch: number;
  };
}


/**
 * O'quv dasturi bazasidan birlamchi nomzodlarni qidirib topish (Retrieval Candidate Generation bosqichi).
 */
export async function retrieveCurriculumCandidates(
  understanding: QueryUnderstanding,
  maxCandidates: number = 50,
): Promise<RerankerCandidate[]> {
  const { detectedSubject, detectedGrade, extractedTopic, keywords } = understanding;

  /*
    0. QAMROV TEKSHIRUVI (V6) — hamma narsadan OLDIN.

    So'ralgan sinf bo'yicha rasmiy dastur umuman raqamlashtirilmagan bo'lsa,
    hech qanday nomzod qaytarilmaydi. Eng yaqin sinfga tushib ketish
    (nearest-grade fallback) MAN ETILADI.

    Reproduksiya (V5 xatti-harakati):
      «1-sinf matematika 10 ichida sonlarni qo'shish va ayirish»
        -> 5-sinf «NATURAL SONLARNI QO'SHISH VA AYIRISH», ball 0.6602
      «4-sinf matematika oddiy kasrlar»
        -> 5-sinf «ODDIY KASRLAR», ball 0.8227

    Bazada 1-4 sinf dasturi YO'Q. Tizim esa eng yaqin sinf bo'limini topib,
    uni "sinf tafovuti" ogohlantirishi bilan taqdim etardi — ya'ni noto'g'ri
    dalilni qonuniylashtirardi.

    DIQQAT: bu 5-11 sinflar orasidagi HAQIQIY cross-grade xatti-harakatiga
    tegmaydi — u yerda ikkala sinf ham dasturda mavjud.
  */
  const coverage = getCurriculumCoverage(detectedSubject, detectedGrade);
  if (!canProvideOfficialEvidence(coverage)) {
    return [];
  }

  // 1. Qidiruv so'zlarini shakllantirish va Query Rewrite
  const rewrites = rewriteQueryForRetrieval(understanding);
  const baseTerms = searchTerms(extractedTopic);
  const stemmedKeywords = keywords.map(stemUzbekWord);

  const expandedTerms = new Set<string>([
    ...baseTerms,
    ...stemmedKeywords,
    extractedTopic,
    ...rewrites.retrievalRepresentations.flatMap((r) => r.split(/\s+/)).filter((w) => w.length >= 3),
  ]);

  // Cross-lingual tushunchalar kengaytmasi — reranker ham AYNAN shu manbadan foydalanadi.
  const conceptExpansion = expandRetrievalTerms(extractedTopic, keywords, detectedSubject, detectedGrade);
  for (const term of conceptExpansion.expandedTerms) {
    expandedTerms.add(term);
    for (const t of term.split(/\s+/)) {
      if (t.length >= 3) expandedTerms.add(t);
    }
  }

  const STOP_CLAUSE_TERMS = new Set([
    "sinf", "класс", "grade", "class",
    "matematika", "ona tili", "adabiyot", "fizika", "kimyo", "biologiya",
    "tarix", "geografiya", "informatika", "ingliz tili", "english", "math", "physics", "chemistry",
    "dars", "reja", "mavzu", "haqida", "uchun", "asosiy", "umumiy"
  ]);

  const isStopTerm = (term: string) => {
    const clean = term.toLowerCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
    if (STOP_CLAUSE_TERMS.has(clean)) return true;
    if (/^\d+-?(?:sinf|klass|grade)?$/i.test(clean)) return true;
    return false;
  };

  /*
    Asosiy qidiruv so'zlari.

    ── V6 TUZATISHI: XOM VA KANONIK ATAMALAR UCHUN KAFOLATLANGAN KVOTA ─────

    Ilgari birlamchi ro'yxatga faqat so'rovdan TO'G'RIDAN-TO'G'RI olingan
    atamalar kirardi. Konsept kengaytmasi («производная» -> «hosila») esa
    faqat `orClauses` ga tushardi, u esa birlamchi qidiruv hech narsa
    topmagan holatdagina ishlatilardi.

    Oqibati: rus/ingliz so'rovlarida transliteratsiya qilingan tokenlar
    ("proizvodnaya", "geometry") bir nechta aloqasiz qatorga mos kelib,
    kengaytma yo'lini butunlay to'sib qo'yardi.
      «pythagorean theorem grade 8» -> gold 8-sinf bo'limi topilmasdi;
      «7-синф она тили феъл нисбатлари» -> atigi 1 ta nomzod.

    Lekin kengaytmani shunchaki ro'yxat BOSHIGA qo'yish ham yaramadi:
    u xom atamalarni chegaradan siqib chiqarib, o'zbekcha so'rovlarni
    buzardi («10-sinf trigonometrik funksiyalar» -> 1 ta nomzod).

    Shuning uchun ikkala manbaga ham KVOTA beriladi: har biridan mustaqil
    ravishda eng ko'pi bilan yarmi olinadi va keyin birlashtiriladi.
  */
  const MAX_PRIMARY_KEYWORDS = 18;
  const QUOTA_PER_SOURCE = MAX_PRIMARY_KEYWORDS / 2;

  const collectVariants = (terms: string[], limit: number): string[] => {
    const collected: string[] = [];
    const seen = new Set<string>();
    for (const term of terms) {
      if (collected.length >= limit) break;
      if (term.length < 3 || isStopTerm(term)) continue;
      for (const variant of getApostropheVariants(term)) {
        if (collected.length >= limit) break;
        if (isStopTerm(variant) || seen.has(variant)) continue;
        seen.add(variant);
        collected.push(variant);
      }
    }
    return collected;
  };

  // So'rovdan to'g'ridan-to'g'ri olingan atamalar.
  const rawPrimaryTerms = collectVariants(
    [...baseTerms, ...stemmedKeywords, extractedTopic],
    QUOTA_PER_SOURCE,
  );

  // Konsept xaritasidan olingan kanonik DTS atamalari (yuqori aniqlikda).
  const canonicalPrimaryTerms = collectVariants(
    conceptExpansion.expandedTerms,
    QUOTA_PER_SOURCE,
  );

  const primaryVariants = new Set<string>([...rawPrimaryTerms, ...canonicalPrimaryTerms]);

  // Barcha kengaytirilgan apostrof variantlarini generatsiya qilish
  const finalVariants = new Set<string>(primaryVariants);
  for (const term of expandedTerms) {
    if (term.length < 3 || isStopTerm(term)) continue;
    for (const variant of getApostropheVariants(term)) {
      if (!isStopTerm(variant)) {
        finalVariants.add(variant);
      }
    }
  }

  const primaryKeywords = Array.from(primaryVariants).slice(0, MAX_PRIMARY_KEYWORDS);
  const searchKeywords = Array.from(finalVariants).slice(0, 16);

  /*
    Nomzodlar tartibi DETERMINISTIK bo'lishi shart.

    `findMany` + `take` `orderBy`siz ishlatilganda PostgreSQL qatorlarni
    ixtiyoriy tartibda qaytaradi. Shunda Recall@20 / Recall@50 o'lchovlari
    bazadagi fizik tartibga bog'lanib qoladi va benchmark takrorlanmaydi.
  */
  const CANDIDATE_ORDER = [
    { grade: "asc" as const },
    { topicName: "asc" as const },
    { id: "asc" as const },
  ];

  const CANDIDATE_SELECT = {
    id: true,
    topicName: true,
    description: true,
    expectedHours: true,
    expectedOutcomes: true,
    source: true,
    subject: true,
    grade: true,
  } as const;

  const primaryClauses = primaryKeywords.flatMap((term) => [
    { topicName: { contains: term, mode: "insensitive" as const } },
    { description: { contains: term, mode: "insensitive" as const } },
  ]);

  const orClauses = searchKeywords.flatMap((term) => [
    { topicName: { contains: term, mode: "insensitive" as const } },
    { description: { contains: term, mode: "insensitive" as const } },
  ]);

  // 2. Birinchi bosqich — so'ralgan sinf va fandan qidirish
  let candidates: RerankerCandidate[] = [];

  /** Sarlavha darajasida mos kelgan boshqa sinf dalillari — sinf filtri ularni saqlab qoladi. */
  const protectedCrossGradeIds = new Set<string>();

  if (detectedSubject && detectedGrade) {
    // 2.1 Avval so'ralgan sinfda birlamchi mavzu atamalariga (primaryClauses) mos keluvchi mavzularni qidiramiz
    const firstClauses = primaryClauses.length > 0 ? primaryClauses : orClauses;
    if (firstClauses.length > 0) {
      candidates = await prisma.curriculumTopic.findMany({
        where: {
          subject: { equals: detectedSubject, mode: "insensitive" },
          grade: { equals: detectedGrade, mode: "insensitive" },
          OR: firstClauses,
        },
        take: maxCandidates,
        orderBy: CANDIDATE_ORDER,
        select: CANDIDATE_SELECT,
      });
    }

    /*
      2.2 CROSS-GRADE RETRIEVAL (V5).

      V4 xatosi: cross-grade qidiruv FAQAT so'ralgan sinfda umuman hech narsa
      topilmagan holatda ishga tushardi. Amalda esa so'ralgan sinfda mavzu
      TAVSIFIDA tasodifiy bitta so'z uchrashi kifoya edi — va o'sha zaif
      moslik boshqa sinfdagi HAQIQIY rasmiy mavzuni butunlay to'sib qo'yardi.

      Reproduksiya: «5-sinf matematika kvadrat tenglama».
      «KVADRAT TENGLAMALAR» 8-sinfda. V4 esa 5-sinfning «NATURAL SONLARNI
      KO'PAYTIRISH VA BO'LISH» bo'limini (tavsifida «kvadrat» so'zi bor)
      0.76 ball bilan qaytarib, uni RASMIY DTS dalili sifatida ko'rsatgan.

      V5 qoidasi: so'ralgan sinfdagi nomzodlarning birortasi ham SARLAVHA
      darajasida mos kelmasa, boshqa sinflardagi sarlavha darajasida mos
      keluvchi nomzodlar ham qo'shiladi. Yakuniy qarorni reranker qabul
      qiladi — undagi sinf masofasi jazosi (-0.10 / -0.25) o'z kuchida qoladi.
    */
    /*
      Cross-grade nomzodlari HAR DOIM yig'iladi.

      Avvalgi variantda ular faqat "so'ralgan sinfda sarlavha mosligi yo'q"
      bo'lganda qo'shilardi. Lekin bitta umumiy so'z ham (masalan
      «tenglamalar») so'ralgan sinfda mos kelib, boshqa sinfdagi ANIQ
      bo'limni to'sib qo'yardi: «9-sinf tenglamalarni yechish» so'rovida
      9-sinfning «TENGLAMALAR VA TENGSIZLIKLAR SISTEMALARI» bo'limi
      6-sinfdagi aynan «TENGLAMALARNI YECHISH» bo'limini yashirardi.

      Qaror rerankerga topshiriladi: undagi sinf masofasi jazosi (-0.10 /
      -0.25) so'ralgan sinfni baribir ustun qo'yadi, faqat boshqa sinfdagi
      moslik SEZILARLI kuchli bo'lsagina u yuqoriga chiqadi.
    */
    if (primaryKeywords.length > 0) {
      const titleClauses = primaryKeywords.map((term) => ({
        topicName: { contains: term, mode: "insensitive" as const },
      }));

      // DIQQAT: sinfni bu yerda `not` bilan chiqarib tashlab bo'lmaydi —
      // Prisma `not: { equals }` ichida `mode: "insensitive"` ni qo'llamaydi.
      // Shuning uchun sinf bo'yicha ajratish JS tomonida bajariladi.
      const crossGradeRows = await prisma.curriculumTopic.findMany({
        where: {
          subject: { equals: detectedSubject, mode: "insensitive" },
          OR: titleClauses,
        },
        take: Math.min(maxCandidates, 20),
        orderBy: CANDIDATE_ORDER,
        select: CANDIDATE_SELECT,
      });

      const crossGradeCandidates = crossGradeRows.filter(
        (c) => c.grade.toLowerCase() !== detectedGrade.toLowerCase(),
      );

      // Sarlavha darajasidagi cross-grade dalillar "himoyalangan" hisoblanadi:
      // 3-bosqichdagi sinf filtri ularni olib tashlamasligi kerak.
      for (const c of crossGradeCandidates) {
        protectedCrossGradeIds.add(c.id);
      }

      const seen = new Set(candidates.map((c) => c.id));
      candidates = [...candidates, ...crossGradeCandidates.filter((c) => !seen.has(c.id))];
    }

    // 2.3 Agar umumiy so'rov bo'lsa (kalit so'zlar bo'yicha cheklov yo'q), shu sinf/fanning barcha mavzulari olinadi
    if (candidates.length === 0) {
      candidates = await prisma.curriculumTopic.findMany({
        where: {
          subject: { equals: detectedSubject, mode: "insensitive" },
          grade: { equals: detectedGrade, mode: "insensitive" },
        },
        take: maxCandidates,
        orderBy: CANDIDATE_ORDER,
        select: CANDIDATE_SELECT,
      });
    }
  }

  // Agar aniq fan/sinf bo'yicha topilmasa yoki fan/sinf noaniq bo'lsa:
  if (candidates.length === 0) {
    const primaryWhere: Record<string, unknown> = {};
    if (detectedSubject) {
      primaryWhere.subject = { equals: detectedSubject, mode: "insensitive" };
    }
    if (detectedGrade) {
      primaryWhere.grade = { equals: detectedGrade, mode: "insensitive" };
    }
    if (orClauses.length > 0) {
      primaryWhere.OR = orClauses;
    }

    candidates = await prisma.curriculumTopic.findMany({
      where: primaryWhere,
      take: maxCandidates,
      orderBy: CANDIDATE_ORDER,
      select: CANDIDATE_SELECT,
    });
  }

  /*
    3. Noto'g'ri sinf filtri.

    So'ralgan sinfda nomzod bo'lsa, boshqa sinflardagilar olib tashlanadi —
    LEKIN 2.2 da sarlavha darajasida topilgan cross-grade dalillar bundan
    mustasno, aks holda ular yana to'silib qolardi.
  */
  let effectiveCandidates = candidates;
  if (detectedGrade) {
    const keep = candidates.filter(
      (c) =>
        c.grade.toLowerCase() === detectedGrade.toLowerCase() ||
        protectedCrossGradeIds.has(c.id),
    );
    if (keep.some((c) => c.grade.toLowerCase() === detectedGrade.toLowerCase())) {
      effectiveCandidates = keep;
    }
  }

  return effectiveCandidates;
}

/**
 * O'quv dasturidan gibrid qidiruv, cross-lingual moslashtirish va ko'p mezonli reyting hisoblash.
 */
export async function matchCurriculumTopics(
  understanding: QueryUnderstanding,
  limit: number = 3,
): Promise<RankedCurriculumMatch[]> {
  const candidates = await retrieveCurriculumCandidates(understanding, 50);
  return rerankCandidates(candidates, understanding, limit);
}
