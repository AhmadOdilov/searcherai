/**
 * Ambiguity Engine — Ko'p ma'noli (polisemik) ta'limiy atamalar tahlili va Clarification Flow (Phase 11).
 *
 * Polisemik atamalar:
 *  - massa (Fizika vs Kimyo vs Matematika)
 *  - ildiz (Matematika vs Biologiya vs Ona tili)
 *  - tok (Fizika vs Biologiya)
 *  - bosim (Fizika vs Biologiya vs Geografiya)
 *  - tola (Biologiya vs Fizika vs Kimyo)
 *  - kuch (Fizika vs Biologiya)
 *  - ish (Fizika vs Pedagogika)
 *  - maydon (Fizika vs Matematika vs Geografiya)
 *  - daraja (Matematika vs Ona tili vs Fizika)
 */

export interface AmbiguityCandidate {
  subject: string;
  confidence: number;
}

export interface AmbiguityResolution {
  isAmbiguous: boolean;
  term?: string;
  resolvedSubject?: string;
  candidates: AmbiguityCandidate[];
  clarificationQuestion?: string;
}

interface PolysemicTermRule {
  term: RegExp;
  contexts: Array<{
    subject: string;
    contextPattern: RegExp;
    weight: number;
  }>;
  defaultCandidates: AmbiguityCandidate[];
  clarificationPromptUz: string;
  clarificationPromptRu: string;
  clarificationPromptEn: string;
}

const POLYSEMIC_RULES: Record<string, PolysemicTermRule> = {
  massa: {
    term: /(?:^|[^\p{L}\p{N}])massa[a-z]*(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:jism|zichlik|tezlik|kuch|nyuton|og['‘`ʻ]irlik|ogirligi|dinamik|iner|плотност|сил|скорост|gravity|density|physics)/i,
        weight: 0.90,
      },
      {
        subject: "Kimyo",
        contextPattern: /(?:molyar|atom|molekula|modda|eritma|valent|reaksiya|хими|химическ|chemistry|molar)/i,
        weight: 0.90,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.50 },
      { subject: "Kimyo", confidence: 0.35 },
      { subject: "Matematika", confidence: 0.15 },
    ],
    clarificationPromptUz: "Ushbu savol Fizika (jism massasi) yoki Kimyo (molyar/atom massasi) faniga tegishlimi?",
    clarificationPromptRu: "Этот вопрос относится к Физике (масса тела) или Химии (молярная масса)?",
    clarificationPromptEn: "Does this question refer to Physics (mass of body) or Chemistry (molar mass)?",
  },
  ildiz: {
    term: /(?:^|[^\p{L}\p{N}])(?:ildiz[a-z]*|корен[а-я]*)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Matematika",
        contextPattern: /(?:kvadrat|daraja|arifmetik|son|tenglama|hisob|algebra|число|уравнени|square root|root)/i,
        weight: 0.92,
      },
      {
        subject: "Biologiya",
        contextPattern: /(?:o['‘`ʻ]simlik|poya|barg|daraxt|hujayra|botanika|urug|gul|растени|корень растения|plant|root system)/i,
        weight: 0.92,
      },
      {
        subject: "Ona tili",
        contextPattern: /(?:so['‘`ʻ]z|o['‘`ʻ]zak|asos|qo['‘`ʻ]shimcha|morfologiya|корень слова)/i,
        weight: 0.88,
      },
    ],
    defaultCandidates: [
      { subject: "Matematika", confidence: 0.55 },
      { subject: "Biologiya", confidence: 0.45 },
    ],
    clarificationPromptUz: "Siz Matematika (kvadrat ildiz) yoki Biologiya (o'simlik ildizi) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Математику (квадратный корень) или Биологию (корень растения)?",
    clarificationPromptEn: "Are you asking about Mathematics (square root) or Biology (plant root)?",
  },
  tok: {
    term: /(?:^|[^\p{L}\p{N}])tok[a-z]*(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:elektr|kuchlanish|zanjir|om qonuni|amper|volt|quvvat|qarshilik|ток цепи|напряжение|electricity|electric current)/i,
        weight: 0.95,
      },
      {
        subject: "Biologiya",
        contextPattern: /(?:uzum|barg|hosil|o['‘`ʻ]simlik|tokzor|agronomi|виноград)/i,
        weight: 0.90,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.65 },
      { subject: "Biologiya", confidence: 0.35 },
    ],
    clarificationPromptUz: "Bu savol Fizika (elektr toki) yoki Biologiya (uzum toki) faniga oidmi?",
    clarificationPromptRu: "Вопрос касается Физики (электрический ток) или Биологии (виноградная лоза)?",
    clarificationPromptEn: "Is this question about Physics (electric current) or Biology (vine)?",
  },
  bosim: {
    term: /(?:^|[^\p{L}\p{N}])(?:bosim[a-z]*|давлен[а-я]*)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:gidrostatik|paskal|atmosfera|gaz|suyuqlik|yuza|kuch|nyuton|давление газа|паскаль|atmospheric pressure|pascal)/i,
        weight: 0.90,
      },
      {
        subject: "Biologiya",
        contextPattern: /(?:qon|arterial|yurak|tomir|organizm|давление крови|blood pressure)/i,
        weight: 0.90,
      },
      {
        subject: "Geografiya",
        contextPattern: /(?:havo|siklon|antitsiklon|iqlim|barometr|klimat)/i,
        weight: 0.85,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.55 },
      { subject: "Biologiya", confidence: 0.30 },
      { subject: "Geografiya", confidence: 0.15 },
    ],
    clarificationPromptUz: "Ushbu savol Fizika (gidrostatik/mexanik bosim) yoki Biologiya (qon bosimi) faniga tegishlimi?",
    clarificationPromptRu: "Этот вопрос относится к Физике (давление тел и газов) или Биологии (кровяное давление)?",
    clarificationPromptEn: "Is this question regarding Physics (pressure in mechanics) or Biology (blood pressure)?",
  },
  tola: {
    term: /(?:^|[^\p{L}\p{N}])tola[a-z]*(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:optik|yorug['‘`ʻ]lik|nur|dielektrik|optika|волокно)/i,
        weight: 0.90,
      },
      {
        subject: "Biologiya",
        contextPattern: /(?:muskul|to['‘`ʻ]qima|hujayra|paxta|o['‘`ʻ]simlik|мышечное волокно)/i,
        weight: 0.90,
      },
      {
        subject: "Kimyo",
        contextPattern: /(?:sun['‘`ʻ]iy|polimer|sintetik|kapron|lavsan|химическое волокно)/i,
        weight: 0.88,
      },
    ],
    defaultCandidates: [
      { subject: "Biologiya", confidence: 0.45 },
      { subject: "Fizika", confidence: 0.35 },
      { subject: "Kimyo", confidence: 0.20 },
    ],
    clarificationPromptUz: "Bu mavzu Optik tola (Fizika), Biologik to'qima (Biologiya) yoki Sintetik tola (Kimyo) haqidami?",
    clarificationPromptRu: "Тема касается Оптического волокна (Физика), Тканей (Биология) или Синтетики (Химия)?",
    clarificationPromptEn: "Does this topic refer to Optical fiber (Physics), Biological fibers (Biology), or Synthetic fibers (Chemistry)?",
  },
  kuch: {
    term: /(?:^|[^\p{L}\p{N}])(?:kuch[a-z]*|сил[а-я]*)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:tortishish|ishqalanish|og['‘`ʻ]irlik|nyuton|dinamika|vektor|tezlanish|ньютон|трения|тяжести|force|newton|gravity)/i,
        weight: 0.92,
      },
      {
        subject: "Biologiya",
        contextPattern: /(?:mushak|jismoniy|odam|harakat|organizm)/i,
        weight: 0.85,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.65 },
      { subject: "Biologiya", confidence: 0.35 },
    ],
    clarificationPromptUz: "Siz Fizika (mexanik kuchlar) yoki Biologiya (mushak kuchi) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Физику (механическая сила) или Биологию (мышечная сила)?",
    clarificationPromptEn: "Are you asking about Physics (mechanical forces) or Biology (muscular force)?",
  },
  ish: {
    term: /(?:^|[^\p{L}\p{N}])(?:ish|ishni|ishning|работа[а-я]*)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:mexanik|foydali|quvvat|joul|energiya|kuch|механическая работа|джоуль|work|energy|joule)/i,
        weight: 0.92,
      },
      {
        subject: "Pedagogika",
        contextPattern: /(?:amaliy|nazorat|laboratoriya|mustaqil|dars|o['‘`ʻ]quvchi)/i,
        weight: 0.85,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.55 },
      { subject: "Ona tili", confidence: 0.45 },
    ],
    clarificationPromptUz: "Ushbu savol Fizika fanidagi «Mexanik ish»ga tegishlimi yoki dars mashg'ulotiga?",
    clarificationPromptRu: "Этот вопрос относится к Физике («Механическая работа») или учебным занятиям?",
    clarificationPromptEn: "Is this question about Physics (mechanical work) or classroom activities?",
  },
  maydon: {
    term: /(?:^|[^\p{L}\p{N}])(?:maydon[a-z]*|поле[а-я]*)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:elektr|magnit|gravitatsiya|induksiya|zaryad|электрическое поле|магнитное поле|field)/i,
        weight: 0.92,
      },
      {
        subject: "Matematika",
        contextPattern: /(?:yuza|sirt|figura|uchburchak|geometriya|площадь)/i,
        weight: 0.88,
      },
      {
        subject: "Geografiya",
        contextPattern: /(?:hudud|yer|davlat|materik|aeroport|teritoriya)/i,
        weight: 0.82,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.50 },
      { subject: "Matematika", confidence: 0.35 },
      { subject: "Geografiya", confidence: 0.15 },
    ],
    clarificationPromptUz: "Bu savol Fizika (elektr/magnit maydoni) yoki Matematika (figura yuzasi) haqidami?",
    clarificationPromptRu: "Вопрос о Физике (электрическое/магнитное поле) или Математике (площадь)?",
    clarificationPromptEn: "Is this about Physics (electric/magnetic field) or Mathematics (surface area)?",
  },
  daraja: {
    term: /(?:^|[^\p{L}\p{N}])(?:daraja[a-z]*|степен[а-я]*)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Matematika",
        contextPattern: /(?:sonning|ko['‘`ʻ]phad|ildiz|asos|ko['‘`ʻ]rsatkich|kvadrat|darajali|степень числа)/i,
        weight: 0.92,
      },
      {
        subject: "Ona tili",
        contextPattern: /(?:sifat|qiyosiy|orttirma|kamaytirma|oddiy|so['‘`ʻ]z turkumi)/i,
        weight: 0.90,
      },
      {
        subject: "Fizika",
        contextPattern: /(?:harorat|selsiy|kelvin|termometr|gradus|градус)/i,
        weight: 0.88,
      },
    ],
    defaultCandidates: [
      { subject: "Matematika", confidence: 0.45 },
      { subject: "Ona tili", confidence: 0.35 },
      { subject: "Fizika", confidence: 0.20 },
    ],
    clarificationPromptUz: "Siz Matematika (son darajasi) yoki Ona tili (sifat darajalari) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Математику (степень числа) или Родной язык (степени прилагательных)?",
    clarificationPromptEn: "Are you asking about Mathematics (powers/exponents) or Language (degrees of comparison)?",
  },
  nur: {
    term: /(?:^|[^\p{L}\p{N}])(?:nur[a-z]*|луч[а-я]*|ray\b)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:yorug['‘`ʻ]lik|optika|sinish|qaytish|spektr|foton|linza|prizma|лазер|свет|преломлени|отражени|optics|light)/i,
        weight: 0.95,
      },
      {
        subject: "Matematika",
        contextPattern: /(?:burchak|burchakning|nuqta|kesma|to['‘`ʻ]g['‘`ʻ]ri chiziq|yarim to['‘`ʻ]g['‘`ʻ]ri|geometri|вершина угла|отрезок|полупрямая|angle|vertex|geometry)/i,
        weight: 0.92,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.55 },
      { subject: "Matematika", confidence: 0.45 },
    ],
    clarificationPromptUz: "Siz Fizika (yorug'lik nuri/optika) yoki Matematika (geometrik nur) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Физику (световой луч) или Математику (геометрический луч)?",
    clarificationPromptEn: "Are you asking about Physics (light ray) or Mathematics (geometric ray)?",
  },
  tezlik: {
    term: /(?:^|[^\p{L}\p{N}])(?:tezlik[a-z]*|скорост[а-я]*|velocity|speed)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:masofa|vaqt|tezlanish|harakat|mexanik|kinematik|km\/soat|m\/s|ньютон|ускорени|движени|displacement|acceleration)/i,
        weight: 0.95,
      },
      {
        subject: "Kimyo",
        contextPattern: /(?:reaksiya|reagent|katalizator|modda|harorat|konsentratsiy|kimyoviy|химическ|катализатор|chemical reaction|reaction rate)/i,
        weight: 0.92,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.65 },
      { subject: "Kimyo", confidence: 0.35 },
    ],
    clarificationPromptUz: "Siz Fizika (harakat tezligi) yoki Kimyo (reaksiya tezligi) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Физику (скорость движения) или Химию (скорость реакции)?",
    clarificationPromptEn: "Are you asking about Physics (speed/velocity) or Chemistry (reaction rate)?",
  },
  energiya: {
    term: /(?:^|[^\p{L}\p{N}])(?:energiya[a-z]*|энерги[а-я]*|energy)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Fizika",
        contextPattern: /(?:kinetik|potensial|mexanik|issiqlik|elektr|ish|joul|quvvat|saqlanish|кинетическ|потенциальн|джоул|kinetic|potential|work|power)/i,
        weight: 0.95,
      },
      {
        subject: "Biologiya",
        contextPattern: /(?:atf|hujayra|moddalar almashinuvi|mitoxondriy|fotosintez|oziqlanish|метаболизм|клеточн|atp|metabolism)/i,
        weight: 0.90,
      },
    ],
    defaultCandidates: [
      { subject: "Fizika", confidence: 0.60 },
      { subject: "Biologiya", confidence: 0.40 },
    ],
    clarificationPromptUz: "Siz Fizika (kinetik/mexanik energiya) yoki Biologiya (hujayra/ATF energiyasi) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Физику (механическая энергия) или Биологию (клеточная энергия/АТФ)?",
    clarificationPromptEn: "Are you asking about Physics (mechanical/kinetic energy) or Biology (cellular energy/ATP)?",
  },
  hujayra: {
    term: /(?:^|[^\p{L}\p{N}])(?:hujayra[a-z]*|клетк[а-я]*|\bcells?\b)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Biologiya",
        contextPattern: /(?:o['‘`ʻ]simlik|hayvon|yadro|sitoplazm|membran|dnk|mikroskop|to['‘`ʻ]qima|bo['‘`ʻ]linish|строени|микроскоп|ткань|biology|organism)/i,
        weight: 0.95,
      },
      {
        subject: "Informatika",
        contextPattern: /(?:jadval|excel|ustun|qator|koordinata|yacheyka|formula|elektron jadval|ячейк|таблиц|spreadsheet|table)/i,
        weight: 0.92,
      },
    ],
    defaultCandidates: [
      { subject: "Biologiya", confidence: 0.65 },
      { subject: "Informatika", confidence: 0.35 },
    ],
    clarificationPromptUz: "Siz Biologiya (tirik hujayra) yoki Informatika (jadval hujayrasi/yacheykasi) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Биологию (живая клетка) или Информатику (ячейка таблицы)?",
    clarificationPromptEn: "Are you asking about Biology (living cell) or Informatics (spreadsheet cell)?",
  },
  tenglama: {
    term: /(?:^|[^\p{L}\p{N}])(?:tenglama[a-z]*|уравнени[а-я]*|equations?)(?=$|[^\p{L}\p{N}])/iu,
    contexts: [
      {
        subject: "Matematika",
        contextPattern: /(?:kvadrat|chiziqli|ildiz|noma['‘`ʻ]lum|sistema|yechish|diskriminant|ko['‘`ʻ]phad|алгебр|квадратн|линейн|дискриминант|algebra|roots|solve)/i,
        weight: 0.95,
      },
      {
        subject: "Kimyo",
        contextPattern: /(?:reaksiya|reagent|kislota|asos|modda|koeffitsient|muvozanat|tuz|oksid|химическ|коэффициент|chemical reaction|stoichiometry)/i,
        weight: 0.92,
      },
    ],
    defaultCandidates: [
      { subject: "Matematika", confidence: 0.65 },
      { subject: "Kimyo", confidence: 0.35 },
    ],
    clarificationPromptUz: "Siz Matematika (algebraik tenglama) yoki Kimyo (kimyoviy reaksiya tenglamasi) haqida so'rayapsizmi?",
    clarificationPromptRu: "Вы имеете в виду Математику (алгебраическое уравнение) или Химию (уравнение химической реакции)?",
    clarificationPromptEn: "Are you asking about Mathematics (algebraic equation) or Chemistry (chemical equation)?",
  },
};

/**
 * Matnni polisemik atamalar bo'yicha tahlil qiladi.
 */
export function resolveAmbiguity(text: string, language: string = "UZ"): AmbiguityResolution | null {
  const lower = text.toLowerCase();

  for (const [key, rule] of Object.entries(POLYSEMIC_RULES)) {
    if (rule.term.test(lower)) {
      // 1. Agar so'rovda to'g'ridan-to'g'ri fan nomi yozilgan bo'lsa, mavzu aniq (ambiguous emas)
      for (const candidate of rule.defaultCandidates) {
        const subjPattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${candidate.subject}|physics|math|biology|chemistry|geography|физик[а-я]*|математик[а-я]*|биолог[а-я]*|хими[а-я]*|географ[а-я]*)(?=$|[^\\p{L}\\p{N}])`, "iu");
        if (subjPattern.test(lower)) {
          return {
            isAmbiguous: false,
            term: key,
            resolvedSubject: candidate.subject,
            candidates: [{ subject: candidate.subject, confidence: 0.98 }],
          };
        }
      }

      // 2. Kontekst mavjudligini tekshiramiz
      for (const ctx of rule.contexts) {
        if (ctx.contextPattern.test(lower)) {
          return {
            isAmbiguous: false,
            term: key,
            resolvedSubject: ctx.subject,
            candidates: [{ subject: ctx.subject, confidence: ctx.weight }],
          };
        }
      }

      // Kontekst yo'q — noaniq (Ambiguous)
      const topDiff = Math.abs(rule.defaultCandidates[0].confidence - rule.defaultCandidates[1].confidence);
      const isAmbiguous = topDiff <= 0.25;

      const clarificationQuestion =
        language === "RU"
          ? rule.clarificationPromptRu
          : language === "EN"
          ? rule.clarificationPromptEn
          : rule.clarificationPromptUz;

      return {
        isAmbiguous,
        term: key,
        candidates: rule.defaultCandidates,
        clarificationQuestion: isAmbiguous ? clarificationQuestion : undefined,
      };
    }
  }

  return null;
}
