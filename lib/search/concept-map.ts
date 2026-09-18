/**
 * Concept Map & Cross-Lingual Query Expansion (Phase 6 & Phase 7).
 *
 * O'zbekiston Davlat Ta'lim Standartlari (DTS) bo'yicha ko'p tilli (UZ ↔ RU ↔ EN)
 * konseptual lug'at va so'rovni kengaytirish dvigateli.
 */

export interface ConceptDefinition {
  conceptKey: string;
  subject: string;
  grades?: string[];
  canonicalUz: string;
  canonicalRu: string;
  canonicalEn: string;
  aliasesUz: string[];
  aliasesRu: string[];
  aliasesEn: string[];
  relatedConcepts: string[];
}

export const CANONICAL_CONCEPTS: ConceptDefinition[] = [
  {
    conceptKey: "fraction",
    subject: "Matematika",
    grades: ["5-sinf", "6-sinf"],
    canonicalUz: "oddiy va o'nli kasrlar",
    canonicalRu: "обыкновенные и десятичные дроби",
    canonicalEn: "fractions and decimals",
    aliasesUz: ["kasr", "oddiy kasr", "o'nli kasr", "surat", "maxraj", "davriy kasr"],
    aliasesRu: ["дробь", "дроби", "обыкновенные дроби", "десятичные дроби", "числитель", "знаменатель"],
    aliasesEn: ["fraction", "fractions", "numerator", "denominator", "decimal", "decimals"],
    relatedConcepts: ["bo'lish", "nisbat", "proporsiya"],
  },
  {
    conceptKey: "quadratic_equation",
    subject: "Matematika",
    grades: ["8-sinf"],
    canonicalUz: "kvadrat tenglamalar",
    canonicalRu: "квадратные уравнения",
    canonicalEn: "quadratic equations",
    aliasesUz: ["kvadrat tenglama", "diskriminant", "viyet", "viyet teoremasi", "ildizlar"],
    aliasesRu: ["квадратное уравнение", "квадратные уравнения", "дискриминант", "теорема виета", "корни уравнения"],
    aliasesEn: ["quadratic equation", "quadratic equations", "discriminant", "vieta", "roots of equation"],
    relatedConcepts: ["chiziqli tenglama", "parabola", "kvadratik funksiya"],
  },
  {
    conceptKey: "linear_equation",
    subject: "Matematika",
    grades: ["7-sinf"],
    canonicalUz: "chiziqli tenglamalar va sistemalar",
    canonicalRu: "линейные уравнения и системы",
    canonicalEn: "linear equations and systems",
    aliasesUz: ["chiziqli tenglama", "tenglamalar sistemasi", "bir noma'lumli", "o'rniga qo'yish usuli"],
    aliasesRu: ["линейное уравнение", "линейные уравнения", "система уравнений", "метод подстановки"],
    aliasesEn: ["linear equation", "system of equations", "linear systems", "substitution method"],
    relatedConcepts: ["birhad", "ko'phad", "tengsizlik"],
  },
  {
    conceptKey: "pythagorean_theorem",
    subject: "Matematika",
    grades: ["8-sinf"],
    canonicalUz: "pifagor teoremasi",
    canonicalRu: "теорема пифагора",
    canonicalEn: "pythagorean theorem",
    aliasesUz: ["pifagor", "gipotenuza", "katet", "to'g'ri burchakli uchburchak"],
    aliasesRu: ["теорема пифагора", "пифагор", "гипотенуза", "катет", "прямоугольный треугольник"],
    aliasesEn: ["pythagorean theorem", "pythagoras", "hypotenuse", "right triangle", "legs"],
    relatedConcepts: ["uchburchak", "geometriya", "metrik munosabatlar"],
  },
  {
    conceptKey: "derivative",
    subject: "Matematika",
    grades: ["11-sinf"],
    canonicalUz: "hosila va uning tatbiqlari",
    canonicalRu: "производная и ее применения",
    canonicalEn: "derivatives and applications",
    aliasesUz: ["hosila", "differensial", "differensiallash", "urinma", "ekstremum", "hosila formulalari"],
    aliasesRu: ["производная", "дифференциал", "дифференцирование", "касательная", "экстремум функции"],
    aliasesEn: ["derivative", "derivatives", "differentiation", "tangent line", "extrema"],
    relatedConcepts: ["funksiya", "limit", "integral"],
  },
  {
    conceptKey: "integral",
    subject: "Matematika",
    grades: ["11-sinf"],
    canonicalUz: "boshlang'ich funksiya va integral",
    canonicalRu: "первообразная и интеграл",
    canonicalEn: "integrals and antiderivatives",
    aliasesUz: ["integral", "boshlang'ich funksiya", "aniq integral", "nyuton-leybnits", "yuzni hisoblash"],
    aliasesRu: ["интеграл", "первообразная", "определенный интеграл", "формула ньютона-лейбница", "площадь трапеции"],
    aliasesEn: ["integral", "integrals", "definite integral", "antiderivative", "fundamental theorem of calculus"],
    relatedConcepts: ["hosila", "differensial"],
  },
  {
    conceptKey: "trigonometry",
    subject: "Matematika",
    grades: ["10-sinf"],
    canonicalUz: "trigonometrik funksiyalar va formulalar",
    canonicalRu: "тригонометрические функции и формулы",
    canonicalEn: "trigonometric functions and identities",
    aliasesUz: ["trigonometriya", "sinus", "kosinus", "tangens", "kotangens", "qo'shish formulalari"],
    aliasesRu: ["тригонометрия", "синус", "косинус", "тангенс", "двойной угол", "тригонометрические формулы"],
    aliasesEn: ["trigonometry", "sine", "cosine", "tangent", "double angle", "trig identities"],
    relatedConcepts: ["burchak", "davriy funksiya"],
  },
  {
    conceptKey: "photosynthesis",
    subject: "Biologiya",
    grades: ["6-sinf", "9-sinf"],
    canonicalUz: "fotosintez jarayoni",
    canonicalRu: "процесс фотосинтеза",
    canonicalEn: "photosynthesis process",
    aliasesUz: ["fotosintez", "yorug'lik fazasi", "qorong'ulik fazasi", "xloroplast", "xlorofill"],
    aliasesRu: ["фотосинтез", "световая фаза", "темновая фаза", "хлоропласт", "хлорофилл"],
    aliasesEn: ["photosynthesis", "light dependent", "calvin cycle", "chloroplast", "chlorophyll"],
    relatedConcepts: ["nafas olish", "o'simlik", "hujayra"],
  },
  {
    conceptKey: "parts_of_speech",
    subject: "Ona tili",
    grades: ["5-sinf", "6-sinf", "7-sinf"],
    canonicalUz: "so'z turkumlari",
    canonicalRu: "части речи",
    canonicalEn: "parts of speech",
    aliasesUz: ["so'z turkumi", "ot", "sifat", "fe'l", "ravish", "olmosh", "son so'z", "bog'lovchi", "ko'makchi"],
    aliasesRu: ["части речи", "существительное", "прилагательное", "глагол", "наречие", "местоимение", "предлог"],
    aliasesEn: ["parts of speech", "noun", "verb", "adjective", "adverb", "pronoun", "preposition"],
    relatedConcepts: ["morfologiya", "gap bo'laklari"],
  },
  {
    conceptKey: "sentences_syntax",
    subject: "Ona tili",
    grades: ["8-sinf", "9-sinf"],
    canonicalUz: "gap sintaksisi va qo'shma gaplar",
    canonicalRu: "синтаксис предложения и сложные предложения",
    canonicalEn: "sentence syntax and compound sentences",
    aliasesUz: ["sintaksis", "ega va kesim", "bosh bo'laklar", "ikkinchi darajali", "qo'shma gap", "ergashgan gap"],
    aliasesRu: ["синтаксис", "подлежащее и сказуемое", "односоставные", "сложносочиненные", "сложноподчиненные"],
    aliasesEn: ["syntax", "subject and predicate", "compound sentences", "complex sentences", "clauses"],
    relatedConcepts: ["tinish belgilari", "punktuatsiya"],
  },
  {
    conceptKey: "newton_mechanics",
    subject: "Fizika",
    grades: ["7-sinf", "9-sinf"],
    canonicalUz: "nyuton qonunlari va mexanika",
    canonicalRu: "законы ньютона и механика",
    canonicalEn: "newton's laws and mechanics",
    aliasesUz: ["nyuton", "nyuton qonuni", "og'irlik kuchi", "inetsiya", "harakat", "tezlanish"],
    aliasesRu: ["законы ньютона", "ньютон", "сила тяжести", "инерция", "ускорение", "механика"],
    aliasesEn: ["newton's laws", "newton", "gravity", "inertia", "acceleration", "classical mechanics"],
    relatedConcepts: ["kuch", "massa", "bosim"],
  },
  {
    conceptKey: "photosynthesis",
    subject: "Biologiya",
    grades: ["5-sinf", "6-sinf", "7-sinf"],
    canonicalUz: "fotosintez jarayoni va o'simliklar oziqlanishi",
    canonicalRu: "процесс фотосинтеза и питание растений",
    canonicalEn: "photosynthesis process and plant nutrition",
    aliasesUz: ["fotosintez", "fotosintezni", "xlorofill", "quyosh energiyasi", "organik modda"],
    aliasesRu: ["фотосинтез", "хлорофилл", "питание растений", "световая фаза", "темновая фаза"],
    aliasesEn: ["photosynthesis", "chlorophyll", "plant nutrition", "light phase", "calvin cycle"],
    relatedConcepts: ["hujayra", "nafas olish", "plastidalar"],
  },
  {
    conceptKey: "ohm_law",
    subject: "Fizika",
    grades: ["8-sinf"],
    canonicalUz: "om qonuni va elektr zanjiri",
    canonicalRu: "закон ома и электрическая цепь",
    canonicalEn: "ohm's law and electric circuit",
    aliasesUz: ["om qonuni", "tok kuchi", "kuchlanish", "qarshilik", "elektr zanjir"],
    aliasesRu: ["закон ома", "сила тока", "напряжение", "сопротивление", "электрическая цепь"],
    aliasesEn: ["ohm's law", "electric current", "voltage", "resistance", "electric circuit"],
    relatedConcepts: ["amper", "volt", "elektr toki"],
  },
  {
    conceptKey: "cell_biology",
    subject: "Biologiya",
    grades: ["5-sinf", "9-sinf"],
    canonicalUz: "hujayra tuzilishi va bo'linishi",
    canonicalRu: "строение и деление клетки",
    canonicalEn: "cell structure and division",
    aliasesUz: ["hujayra", "mitoz", "meyoz", "yadro", "sitoplazma", "organoid"],
    aliasesRu: ["клетка", "митоз", "мейоз", "ядро", "цитоплазма", "органоиды"],
    aliasesEn: ["cell", "mitosis", "meiosis", "nucleus", "cytoplasm", "organelles"],
    relatedConcepts: ["dnk", "xromosoma", "sitologiya"],
  },
];

/**
 * Matn ichidagi konseptlarni aniqlaydi va ko'p tilli qidiruv uchun kengaytirilgan kalit so'zlarni qaytaradi.
 */
export function expandQueryConcepts(
  text: string,
  subject?: string,
  _grade?: string,
): {
  matchedConcepts: string[];
  expandedTerms: string[];
} {
  const lower = text.toLowerCase();
  const matched: ConceptDefinition[] = [];
  const expanded = new Set<string>();

  for (const concept of CANONICAL_CONCEPTS) {
    if (subject && concept.subject.toLowerCase() !== subject.toLowerCase()) {
      continue;
    }

    const allAliases = [
      ...concept.aliasesUz,
      ...concept.aliasesRu,
      ...concept.aliasesEn,
      concept.canonicalUz,
      concept.canonicalRu,
      concept.canonicalEn,
    ];

    const isMatch = allAliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const reg = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
      return reg.test(lower);
    });

    if (isMatch) {
      matched.push(concept);
      // O'zbekcha kanonik va sinonimlar (birlamchi bazadagi o'zbekcha kurrikulumga moslash)
      expanded.add(concept.canonicalUz);
      for (const a of concept.aliasesUz) expanded.add(a);
      // Ruscha va inglizcha variantlar
      for (const a of concept.aliasesRu) expanded.add(a);
      for (const a of concept.aliasesEn) expanded.add(a);
    }
  }

  return {
    matchedConcepts: matched.map((m) => m.conceptKey),
    expandedTerms: Array.from(expanded),
  };
}
