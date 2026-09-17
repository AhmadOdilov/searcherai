/**
 * Qidiruv so'rovini chuqur tahlil qilish (Query Understanding — Intelligence V2).
 *
 * Vazifalari:
 *  1. Tilni aniqlash (UZ, RU, EN).
 *  2. Fanni aniqlash va ko'p ma'nolilikni (disambiguation) hal qilish.
 *  3. Sinfni aniqlash (1-sinf ... 11-sinf) va kelishik qo'shimchalarini (8-sinfga) to'g'ri ajratish.
 *  4. Intent va uning confidence darajasini hisoblash.
 *  5. Auditoriyani aniqlash (teacher yoki student).
 *  6. Multi-turn suhbat kontekstini inobatga olish (Phase 14).
 *  7. Asosiy ilmiy/ta'limiy mavzuni (topic/entities) ajratib olish.
 */

import type { LanguageCode } from "@/lib/validations/common";
import { normalizeQuery, type NormalizedQuery } from "./normalization";

export type SearchIntent =
  | "explain"
  | "lesson_plan"
  | "presentation"
  | "quiz_test"
  | "worksheet"
  | "curriculum"
  | "classroom_activity"
  | "definition"
  | "compare"
  | "search_topic";

export type AudienceMode = "teacher" | "student";

export interface SubjectCandidate {
  subject: string;
  confidence: number;
}

export interface IntentResult {
  intent: SearchIntent;
  confidence: number;
}

export interface ConversationTurnContext {
  previousTopic?: string;
  previousSubject?: string;
  previousGrade?: string;
  previousLanguage?: LanguageCode;
  previousIntent?: SearchIntent;
}

export interface QueryUnderstanding {
  normalized: NormalizedQuery;
  detectedLanguage: LanguageCode;
  detectedSubject?: string;
  subjectConfidence: number;
  subjectCandidates: SubjectCandidate[];
  detectedGrade?: string;
  detectedIntent: SearchIntent;
  intentConfidence: number;
  audience: AudienceMode;
  extractedTopic: string;
  keywords: string[];
}

/**
 * Ko'p tilli fanlar lug'ati (O'zbek, Rus, Ingliz) va ularning kalit so'zlari.
 */
interface SubjectDefinition {
  subject: string;
  strongPatterns: RegExp[];
  keywordWeights: Array<{ pattern: RegExp; weight: number }>;
}

const SUBJECT_DEFINITIONS: SubjectDefinition[] = [
  {
    subject: "Matematika",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:matematik[a-z]*|algebra[a-z]*|geometri[a-z]*|arifmetik[a-z]*|trigonometri[a-z]*|integral[a-z]*|differensial[a-z]*|математик[а-я]*|алгебр[а-я]*|геометр[а-я]*|арифметик[а-я]*|тригонометри[а-я]*|интеграл[а-я]*|дифференциал[а-я]*|mathematics?|math\b|calculus|geometry|algebra|arithmetic|trigonometry)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:kasr[a-z]*|tenglama[a-z]*|tengsizlik[a-z]*|natural son|butun son|ratsional son|haqiqiy son|oddiy kasr|o['‘`ʻ]nli kasr|burchak|uchburchak|to['‘`ʻ]rtburchak|doira|perimetr|yuzi|pifagor|viyet|diskriminant|kvadrat tenglama|birhad|ko['‘`ʻ]phad|arifmetik progressiya|geometrik progressiya|hosila|boshlang['‘`ʻ]ich funksiya|ehtimollar nazariyasi|matematik statistika|jadval|foiz|nisbat|proporsiya|ko['‘`ʻ]paytirish|bo['‘`ʻ]lish|qo['‘`ʻ]shish|ayirish|daraja|ildiz)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:дроб[а-я]*|дроби|уравнени[а-я]*|неравенств[а-я]*|числа|натуральн[а-я]*|целые числа|координат[а-я]*|функци[а-я]*|квадратичн[а-я]*|квадратн[а-я]*|корен[а-я]*|корни|производн[а-я]*|первообразн[а-я]*|пифагор[а-я]*|виет[а-я]*|дискриминант|умножени[а-я]*|делени[а-я]*|сложени[а-я]*|вычитани[а-я]*|прогресси[а-я]*|логарифм[а-я]*|sin|cos|tg|ctg|таблицу умножения)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:fractions?|equations?|pythagorean|theorem|quadratic|polynomials?|integers?|rational|linear|system|derivatives?|integrals?|logarithm|exponential|matrices|matrix|probability|angles?|triangles?|mental calculation|addition|subtraction|multiplication|division)\b/i, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:drob[a-z]*|drobi|uravneni[a-z]*|diskriminant|pifagor|logarifm|funksiya|hosila|integral)(?=$|[^\p{L}\p{N}])/giu, weight: 0.8 },
    ],
  },
  {
    subject: "Ona tili",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:ona tili|adabiyot[a-z]*|grammatik[a-z]*|ona tilidan|она тили|адабиёт[а-я]*|русский язык|литератур[а-я]*|uzbek language|mother tongue)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:so['‘`ʻ]z turkum[a-z]*|ot so['‘`ʻ]z|sifat so['‘`ʻ]z|fe['‘`ʻ]l|ravish|olmosh|son so['‘`ʻ]z|bog['‘`ʻ]lovchi|ko['‘`ʻ]makchi|yuklama|undov|sintaksis|gap bo['‘`ʻ]laklari|ega va kesim|bir tarkibli|qo['‘`ʻ]shma gap|ergashgan|bog['‘`ʻ]langan|fonetika|tovush|unli|undosh|so['‘`ʻ]z tarkibi|asos va qo['‘`ʻ]shimcha|matn tilshunosligi|uslubiyat|nutq madaniyati|notiqlik|she['‘`ʻ]r|g['‘`ʻ]azal|alisher navoiy|navoiy|boburnoma|cho['‘`ʻ]lpon|abdulla qodiriy)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:существительн[а-я]*|прилагательн[а-я]*|глагол[а-я]*|наречи[а-я]*|местоимени[а-я]*|предлог[а-я]*|союз[а-я]*|частиц[а-я]*|подлежащ[а-я]*|сказуем[а-я]*|синтаксис|пунктуаци[а-я]*|орфографи[а-я]*|сложносочиненн[а-я]*|сложноподчиненн[а-я]*|открытому уроку по литературе|произведени[а-я]*|стихотворени[а-я]*)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:grammar|syntax|phonetics|parts of speech|nouns?|verbs?|adjectives?|adverbs?|pronouns?|conjunctions?|prepositions?|literature|oral presentation in literature|essay|reading comprehension)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Fizika",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:fizik[a-z]*|физик[а-я]*|physics)\b/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:mexanik[a-z]*|optik[a-z]*|termodinamik[a-z]*|dinamik[a-z]*|kinematik[a-z]*|bosim|zichlik|og['‘`ʻ]irlik|massa|tezlik|tezlanish|kuch|nyuton|paskal|arximed|om qonuni|amper|volt|tok kuchi|elektr zanjiri|magnit|diffuziya|issiqlik miqdori|solishtirma issiqlik|issiqlik sig['‘`ʻ]imi|fotoeffekt|yorug['‘`ʻ]lik)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:механик[а-я]*|оптик[а-я]*|термодинамик[а-я]*|динамик[а-я]*|кинематик[а-я]*|плотност[а-я]*|давлен[а-я]*|скорост[а-я]*|ускорени[а-я]*|сил[а-я]*|ньютон[а-я]*|паскал[а-я]*|архимед[а-я]*|закон ома|закон паскаля|законы ньютона|электричеств[а-я]*|ток[а-я]*|магнитн[а-я]*|диффузи[а-я]*|теплоемкост[а-я]*|участок цепи)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:velocity|acceleration|speed|density|pressure|force|gravity|newton|newton's|pascal|pascal's|ohm|ohm's|thermodynamics|optics|electricity|heat capacity|kinetic|potential energy)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Kimyo",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:kimyo[a-z]*|хими[а-я]*|chemistry|chemical)\b/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:davriy jadval|davriy qonun|mendeleyev|mendeleev|atom tuzilishi|atom|molekula|modda|reaksiya|valentlik|valent|oksid[a-z]*|kislota[a-z]*|asos[a-z]*|tuz[a-z]*|eritma[a-z]*|kislorod|vodorod|uglevodorod[a-z]*|organik kimyo|noorganik kimyo|anorganik|kimyoviy bog['‘`ʻ]lanish|kovalent|ionli|elektrolit|metallmas|polimer[a-z]*|molyar massa)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:периодическ[а-я]*|менделеев[а-я]*|строение атома|атом[а-я]*|молекул[а-я]*|веществ[а-я]*|реакци[а-я]*|валентност[а-я]*|оксид[а-я]*|кислот[а-я]*|основани[а-я]*|раствор[а-я]*|кислород[а-я]*|водород[а-я]*|химическ[а-я]* связ[а-я]*|молярная масса|лабораторной работы по химии)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:periodic table|atoms?|molecules?|reactions?|valence|valency|acids?|bases?|oxides?|solutions?|chemical bonds?|polymers?|molar mass|organic chemistry)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Biologiya",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:biolog[a-z]*|биолог[а-я]*|biology|biological)\b/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:fotosintez|hujayra|nafas olish|botanik[a-z]*|zoologiy[a-z]*|anatomiy[a-z]*|odam anatomiyasi|qon aylanish|yurak|o['‘`ʻ]simlik|gul tuzilishi|ildiz|poya|barg|urug['‘`ʻ]|irsiyat|genetik[a-z]*|dnk|rnk|xromosoma|darvin|evolyutsiya|ekologiya|umurtqali|umurtqasiz|bakteriya|virus)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:фотосинтез[а-я]*|клетк[а-я]*|дыхани[а-я]*|ботаник[а-я]*|зоологи[а-я]*|анатоми[а-я]*|кровеносн[а-я]*|строени[а-я]* цветк[а-я]*|растени[а-я]*|наследственност[а-я]*|генетик[а-я]*|днк|рнк|эволюци[а-я]*|дарвин[а-я]*|микроскоп[а-я]*)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:photosynthesis|cells?|microscope|respiration|circulatory system|genetics?|dna|rna|evolution|darwin|botany|zoology|anatomy|plants?|organisms?|heredity)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Tarix",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:tarix[a-z]*|тарих[а-я]*|истори[а-я]*|history|historical)\b/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:jahon tarixi|o['‘`ʻ]zbekiston tarixi|qadimgi dunyo|sulola|jang|amir temur|temuriylar|bobur|boburiylar|somoniylar|qoraxoniylar|arxeologiya|ehromlar|misr|rim|gretsiya|kashfiyotlar|jadid|jadidchilik|mustaqillik)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:история древнего мира|древн[а-я]* мир[а-я]*|египетск[а-я]* пирамид[а-я]*|амир[а-я]* темур[а-я]*|государство амира темура|великие географические|династи[а-я]*|битва|война)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:ancient rome|ancient egypt|pyramids?|alexander|temur|tamerlane|middle ages|renaissance|dynasty|empire|civilization|world history)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Geografiya",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:geograf[a-z]*|географ[а-я]*|geography|geographic)\b/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:materik[a-z]*|okean[a-z]*|iqlim|xarita|globus|aholi|tabiiy zona|relyef|tog['‘`ʻ]lar|daryolar|afrika|yevrosiyo|amerika|antarktida|avstraliya|tabiiy geografiya)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:материк[а-я]*|океан[а-я]*|климат[а-я]*|карт[а-я]*|населени[а-я]*|рельеф[а-я]*|еврази[а-я]*|африк[а-я]*)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:continents?|oceans?|climate|maps?|population|topography|equator|hemisphere)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Informatika",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:informatik[a-z]*|информатик[а-я]*|informatics|computer science)\b/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:dasturlash|algoritm[a-z]*|kompyuter|axborot|python|html|css|javascript|kodlash|blok sxema|kompyuter grafikasi|operatsion sistema|qurilmalari)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:программирован[а-я]*|алгоритм[а-я]*|компьютер[а-я]*|блок схем[а-я]*|python|информационн[а-я]*|устройства компьютера)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:programming|coding|algorithm|algorithms|python|scratch|html|css|computer|hardware|software|binary|flowchart)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Ingliz tili",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:ingliz tili|ingliz tilidan|английск[а-я]*|english)\b/giu,
    ],
    keywordWeights: [
      { pattern: /\b(?:present simple|present continuous|present perfect|past simple|past continuous|future simple|tenses|irregular verbs|vocabulary|grammar exercises)\b/i, weight: 0.95 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:inglizcha|grammatika ingliz|english grammar)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
    ],
  },
];

/** Intent markerlari va ularning confidence darajalari (Phase 7) */
const INTENT_PATTERNS: Array<{ intent: SearchIntent; confidence: number; patterns: RegExp[] }> = [
  {
    intent: "lesson_plan",
    confidence: 0.95,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:dars ishlanma[a-z]*|dars reja[a-z]*|konspekt[a-z]*|45 daqiqa|45 minut|texnologik xarita|поурочный план|план урока|конспект урока|lesson plan|teaching plan)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "presentation",
    confidence: 0.95,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:prezentatsiya[a-z]*|prizintatsiya[a-z]*|taqdimot[a-z]*|slayd[a-z]*|powerpoint|pptx|презентаци[а-я]*|слайд[а-я]*|presentation|slides)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "quiz_test",
    confidence: 0.92,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:test|testlar|viktorina|savol-javob|nazorat ishi|savollar tuz|тест[а-я]*|вопросы к уроку|quiz|test questions|exam questions)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "worksheet",
    confidence: 0.90,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:mashq|mashqlar|topshiriq|topshiriqlar|tarqatma|amaliy ish|uyga vazifa|упражнени[а-я]*|задани[а-я]*|раздаточн[а-я]*|worksheet|exercises|homework)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "curriculum",
    confidence: 0.92,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:o['‘`ʻ]quv dasturi|davlat dasturi|soat|ajratilgan soat|dts|standart|mavzular ketma-ketligi|учебная программа|распределение часов|стандарт|curriculum|syllabus|hours distribution)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "classroom_activity",
    confidence: 0.90,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:qanday metod|interaktiv usul|metodika|o['‘`ʻ]yin|faoliyat|guruhlarda ishlash|guruhda ishlash|sinfda qo['‘`ʻ]llash|tajriba|laboratoriya mashg['‘`ʻ]uloti|metodist|методика|игры на уроке|групповая работа|classroom activity|active learning|classroom management|teaching method)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "definition",
    confidence: 0.90,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:ta['‘`ʻ]rifi|ta['‘`ʻ]rif|qoidasi|nima(?: degani)?|определени[а-я]*|что такое|definition of|meaning of)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "compare",
    confidence: 0.90,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:taqqosla[a-z]*|farqi|o['‘`ʻ]xshashligi|solishtir[a-z]*|farqlari|сравни[а-я]*|разниц[а-я]* между|compare|difference between)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "explain",
    confidence: 0.85,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:tushuntir[a-z]*|tushuntirish|tushuntirib ber|mohiyati|объясни[а-я]*|как объяснить|explain|how to explain)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
];

/**
 * Matn tilini aniqlaydi (Uzbek, Russian, English).
 */
export function detectLanguage(text: string, fallback: LanguageCode = "UZ"): LanguageCode {
  // 1. O'zbekcha o'ziga xos belgilar yoki kalit so'zlar
  if (
    /[ўқғҳ]|\b(?:o['‘`ʻ]|g['‘`ʻ])/i.test(text) ||
    /(?:^|[^\p{L}\p{N}])(?:dars|sinf|uchun|qanday|nima|ishlanma|reja|haqida|mavzu|tushuntir|o['‘`ʻ]quvchi|kasr|tenglama|mashq|amallar|so['‘`ʻ]z|bilan|yoki|ega|kesim|босим|мавзусига|синф|бўйича|ҳамда)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "UZ";
  }

  // 2. Inglizcha kalit so'zlar
  if (
    /\b(?:how|what|why|lesson|plan|grade|class|teach|explain|student|teacher|quiz|worksheet|activity|difference|between|formulas?|definition|questions?|summary|learning|equations?|pythagorean|theorem|photosynthesis)\b/i.test(text)
  ) {
    return "EN";
  }

  // 3. Ruscha belgilar yoki kalit so'zlar
  if (
    /[ыэъё]/i.test(text) ||
    /(?:^|[^\p{L}\p{N}])(?:как|что|это|урок[а-я]*|план[а-я]*|для|класс[а-я]*|объясн[а-я]*|вопрос[а-я]*|почему|зачем|поурочн[а-я]*|дроб[а-я]*|задач[а-я]*|упражнен[а-я]*|слайд[а-я]*|презентаци[а-я]*|конспект[а-я]*|тест[а-я]*|помог[а-я]*|ученик[а-я]*|школьник[а-я]*|по|на|разниц[а-я]*|между|игры|строени[а-я]*|закон[а-я]*|правил[а-я]*|учителю|не понял|завтра)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "RU";
  }

  // Agar kirill matn bo'lib, o'zbekcha belgilar uchramasa
  if (text.match(/[\u0400-\u04FF]/g)) {
    return "RU";
  }

  return fallback;
}

/**
 * Kontekstga bog'liq ko'p ma'noli so'zlarni (Disambiguation — Phase 5) tekshiradi.
 */
function disambiguateKeywords(text: string): { resolvedSubject?: string; candidates?: SubjectCandidate[] } | null {
  const lower = text.toLowerCase();

  // 1. "massa" atamasi: Fizika vs Kimyo vs Matematika
  if (/(?:^|[^\p{L}\p{N}])massa(?=$|[^\p{L}\p{N}])/iu.test(lower)) {
    if (/(?:jism|zichlik|tezlik|kuch|nyuton|og['‘`ʻ]irlik|плотност|сил|скорост|gravity|density|physics|ogirligi)/i.test(lower)) {
      return { resolvedSubject: "Fizika" };
    }
    if (/(?:molyar|atom|molekula|modda|eritma|kimyo|хими|химическ|chemistry|molar)/i.test(lower)) {
      return { resolvedSubject: "Kimyo" };
    }
    // Noaniq yakka "massa nima degani?"
    return {
      resolvedSubject: undefined,
      candidates: [
        { subject: "Fizika", confidence: 0.50 },
        { subject: "Kimyo", confidence: 0.35 },
        { subject: "Matematika", confidence: 0.15 },
      ],
    };
  }

  // 2. "ildiz" atamasi: Matematika vs Biologiya
  if (/(?:^|[^\p{L}\p{N}])(?:ildiz|корен[а-я]*)(?=$|[^\p{L}\p{N}])/iu.test(lower)) {
    if (/(?:kvadrat|daraja|arifmetik|son|tenglama|hisob|математик|уравнени|math|algebra)/i.test(lower)) {
      return { resolvedSubject: "Matematika" };
    }
    if (/(?:o['‘`ʻ]simlik|poya|barg|daraxt|hujayra|botanika|биолог|растени|plant)/i.test(lower)) {
      return { resolvedSubject: "Biologiya" };
    }
    // Noaniq yakka "ildiz haqida ma'lumot ber"
    return {
      resolvedSubject: undefined,
      candidates: [
        { subject: "Matematika", confidence: 0.55 },
        { subject: "Biologiya", confidence: 0.45 },
      ],
    };
  }

  return null;
}

/**
 * So'rovdan fanni aniqlaydi va confidence hamda nomzodlar bilan qaytaradi (Phase 5).
 */
export function detectSubjectDetails(
  text: string,
  rawText?: string,
): { subject?: string; confidence: number; candidates: SubjectCandidate[] } {
  // Avval ko'p ma'noli so'zlar tekshiruvi (Disambiguation)
  const disambiguation = disambiguateKeywords(text) ?? (rawText ? disambiguateKeywords(rawText) : null);
  if (disambiguation) {
    if (disambiguation.resolvedSubject) {
      return {
        subject: disambiguation.resolvedSubject,
        confidence: 0.90,
        candidates: [{ subject: disambiguation.resolvedSubject, confidence: 0.90 }],
      };
    }
    return {
      subject: undefined,
      confidence: disambiguation.candidates?.[0]?.confidence ?? 0.50,
      candidates: disambiguation.candidates ?? [],
    };
  }

  const scores: Record<string, number> = {};

  for (const def of SUBJECT_DEFINITIONS) {
    let score = 0;

    // Kuchli patternlar (fanning aniq nomi kelsa)
    for (const pat of def.strongPatterns) {
      if (pat.test(text) || (rawText && pat.test(rawText))) {
        score += 1.0;
      }
    }

    // Kalit so'zlar bo'yicha vaznlar
    for (const kw of def.keywordWeights) {
      if (kw.pattern.test(text) || (rawText && kw.pattern.test(rawText))) {
        score += kw.weight;
      }
    }

    if (score > 0) {
      scores[def.subject] = score;
    }
  }

  const candidates: SubjectCandidate[] = Object.entries(scores)
    .map(([subject, rawScore]) => ({
      subject,
      confidence: Math.min(1.0, Number((rawScore / (rawScore + 0.5)).toFixed(2))),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return {
      subject: undefined,
      confidence: 0,
      candidates: [],
    };
  }

  const top = candidates[0];
  // Agar eng yuqori ishonch >= 0.60 bo'lsa, aniq fan sifatida qabul qilamiz
  if (top.confidence >= 0.60) {
    return {
      subject: top.subject,
      confidence: top.confidence,
      candidates,
    };
  }

  return {
    subject: undefined,
    confidence: top.confidence,
    candidates,
  };
}

/**
 * Orqaga muvofiqlik uchun standart detectSubject.
 */
export function detectSubject(text: string): string | undefined {
  return detectSubjectDetails(text).subject;
}

/**
 * So'rovdan sinf darajasini aniqlaydi ("1-sinf" ... "11-sinf") (Phase 6).
 * Kelishik qo'shimchalarini (8-sinfga, 8-sinfdan) ham to'g'ri ajratadi.
 */
export function detectGrade(text: string, contextGrade?: string): string | undefined {
  const m1 = text.match(/(?:^|[^\p{L}\p{N}])([1-9]|1[0-1])\s*[-_]?\s*(?:sinf|синф|class|grade|класс)(?:[a-z'\p{L}]*)?(?=$|[^\p{L}\p{N}])/iu);
  if (m1) {
    return `${m1[1]}-sinf`;
  }

  const m2 = text.match(/(?:^|[^\p{L}\p{N}])(?:sinf|синф|class|grade|класс)\s*[-_]?\s*([1-9]|1[0-1])(?=$|[^\p{L}\p{N}])/iu);
  if (m2) {
    return `${m2[1]}-sinf`;
  }

  if (contextGrade) {
    return contextGrade;
  }

  return undefined;
}

/**
 * So'rov intentini aniqlaydi va confidence darajasi bilan qaytaradi (Phase 7).
 */
export function detectIntentDetails(text: string, rawText?: string): IntentResult {
  for (const item of INTENT_PATTERNS) {
    for (const pattern of item.patterns) {
      if (pattern.test(text) || (rawText && pattern.test(rawText))) {
        return {
          intent: item.intent,
          confidence: item.confidence,
        };
      }
    }
  }

  // Standart fallback — explain, lekin confidence past (0.50)
  return {
    intent: "explain",
    confidence: 0.50,
  };
}

export function detectIntent(text: string, rawText?: string): SearchIntent {
  return detectIntentDetails(text, rawText).intent;
}

/**
 * Auditoriyani aniqlaydi (o'qituvchi yoki o'quvchi).
 */
export function detectAudience(text: string, intent: SearchIntent): AudienceMode {
  if (
    intent === "lesson_plan" ||
    intent === "presentation" ||
    intent === "curriculum" ||
    intent === "classroom_activity" ||
    /(?:^|[^\p{L}\p{N}])(?:o['‘`ʻ]qituvchi|sinfda|darsga|o['‘`ʻ]quvchilarga|baholash|konspekt|metodist|учителю|на уроке|lesson plan|classroom)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "teacher";
  }

  if (
    /(?:^|[^\p{L}\p{N}])(?:menga tushunarsiz|tushunmadim|o['‘`ʻ]quvchiman|masalani yech|uy vazifam|maktabdaman|я ученик|школьник|домашнее задание|i am a student|help with my homework)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "student";
  }

  return "teacher";
}

/**
 * So'rovdan asosiy mavzu / ob'ektni (topic) ajratadi.
 */
export function extractTopic(
  text: string,
  subject?: string,
  grade?: string,
): { topic: string; keywords: string[] } {
  let cleaned = text.replace(/<[^>]*>/g, " ");

  // 1. Sinfni olib tashlash
  if (grade) {
    cleaned = cleaned.replace(new RegExp(`\\b${grade}\\b`, "gi"), "");
  }
  cleaned = cleaned.replace(/\b([1-9]|1[0-1])\s*[-_]?\s*(?:sinf|синф|class|grade|класс)(?:[a-z'\p{L}]*)?\b/giu, "");

  // 2. Fan nomlarini olib tashlash
  if (subject) {
    cleaned = cleaned.replace(new RegExp(`\\b${subject}\\b`, "gi"), "");
  }
  for (const def of SUBJECT_DEFINITIONS) {
    for (const pattern of def.strongPatterns) {
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  // 3. Umumiy savol va intent so'zlarini tozalash
  cleaned = cleaned.replace(
    /(?:^|[^\p{L}\p{N}])(?:uchun|haqida|nima|qanday|tushuntir|tushuntirish|tushuntirib ber|ber|kerak|qilish|qil|qilib|tuz|tuzib|tayyorla|tayyorlab|yoz|yozib|ko['‘`ʻ]rsat|endi|yana|dars|ishlanma|dars ishlanma|dars ishlanmasi|dars reja|reja|slayd|slaydlar|prezentatsiya|taqdimot|test|testlar|savol|savollar|metod|metodika|mavzusi|mavzusini|mavzuda|qoidasi|ta['‘`ʻ]rifi|konspekt|turi|turlari|qisqa|для|как|план|урока|поурочный|слайды|тест|вопросы|упражнения|конспект|задания|еще|сделай|напиши|по|на|в|из|с|со|к|lesson|plan|slides|presentation|quiz|worksheet|explain|how to|for|and|the|with|of|to|in|at|on|questions?|exercises?|summary|sheet)(?=$|[^\p{L}\p{N}])/giu,
    " ",
  );

  // Miqdor ifodalarini tozalash (10 ta, 5 ta)
  cleaned = cleaned.replace(/\b\d+\s*ta\b/giu, " ");

  // Tinish belgilaridan tozalash (lekin so'z ichidagi apostroflar saqlanadi)
  cleaned = cleaned.replace(/[?!.,;:"()\[\]{}—–\-_/\\#@*+=]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w));

  const topic = words.join(" ").trim();
  return {
    topic: topic.length > 0 ? topic : text.trim(),
    keywords: words,
  };
}

/**
 * Foydalanuvchi so'rovini to'liq tahlil qilib, strukturaviy tushunish obyektini qaytaradi.
 * Multi-turn suhbat kontekstini (conversationContext) to'liq qo'llab-quvvatlaydi (Phase 14).
 */
export function understandQuery(
  rawQuery: string,
  manualSubject?: string,
  manualGrade?: string,
  manualLanguage?: LanguageCode,
  conversationContext?: ConversationTurnContext,
): QueryUnderstanding {
  const normalized = normalizeQuery(rawQuery);

  const detectedLanguage = manualLanguage ?? (conversationContext?.previousLanguage && rawQuery.trim().split(/\s+/).length <= 3 ? conversationContext.previousLanguage : detectLanguage(rawQuery));

  const subjectDetails = detectSubjectDetails(normalized.normalized, rawQuery);
  let detectedSubject = manualSubject ?? subjectDetails.subject;
  let subjectConfidence = manualSubject ? 1.0 : subjectDetails.confidence;
  let subjectCandidates = subjectDetails.candidates;

  // Agar joriy so'rovda fan topilmasa va kontekstda mavjud bo'lsa (Phase 14 Multi-turn)
  if (!detectedSubject && conversationContext?.previousSubject) {
    detectedSubject = conversationContext.previousSubject;
    subjectConfidence = 0.85;
    subjectCandidates = [{ subject: detectedSubject, confidence: 0.85 }];
  }

  const detectedGrade = manualGrade ?? detectGrade(normalized.normalized, conversationContext?.previousGrade);
  const intentDetails = detectIntentDetails(normalized.normalized, rawQuery);
  const detectedIntent = intentDetails.intent;
  const intentConfidence = intentDetails.confidence;
  const audience = detectAudience(normalized.normalized, detectedIntent);

  let { topic: extractedTopic, keywords } = extractTopic(
    normalized.normalized,
    detectedSubject,
    detectedGrade,
  );

  // Multi-turn topic inheritance (Phase 14):
  // Agar joriy so'rovda faqat sinf, intent yoki bog'lovchi so'zlar bo'lsa (yangi mavzu bo'lmasa)
  const isOnlyFollowupModifiers =
    keywords.length === 0 ||
    extractedTopic.length < 3 ||
    /^(?:sinf|uchun|test|qil|ber|endi|dars|reja|\d+-[a-z]+)$/i.test(extractedTopic);

  if (isOnlyFollowupModifiers && conversationContext?.previousTopic) {
    extractedTopic = conversationContext.previousTopic;
    const parentTopicInfo = extractTopic(conversationContext.previousTopic, detectedSubject, detectedGrade);
    keywords = parentTopicInfo.keywords.length > 0 ? parentTopicInfo.keywords : [conversationContext.previousTopic];
  }

  return {
    normalized,
    detectedLanguage,
    detectedSubject,
    subjectConfidence,
    subjectCandidates,
    detectedGrade,
    detectedIntent,
    intentConfidence,
    audience,
    extractedTopic,
    keywords,
  };
}
