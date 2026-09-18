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
import { resolveAmbiguity } from "./ambiguity";
import { getCorrectionSuggestions } from "./typo-engine";

export type SearchIntent =
  | "explain"
  | "definition"
  | "solve"
  | "lesson_plan"
  | "presentation"
  | "quiz_test"
  | "worksheet"
  | "homework"
  | "curriculum"
  | "compare"
  | "summarize"
  | "summary"
  | "example"
  | "classroom_activity"
  | "activity"
  | "assessment"
  | "search_topic"
  | "topic_search"
  | "fact_check"
  | "experiment"
  | "translation"
  | "exam_prep";

export type AudienceMode = "teacher" | "student";

export interface SubjectCandidate {
  subject: string;
  confidence: number;
}

export interface IntentCandidate {
  intent: SearchIntent;
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

export interface QueryUnderstandingEntities {
  terms: string[];
  gradeMentions: string[];
  subjectMentions: string[];
  keywords: string[];
}

export interface QueryAmbiguityFlags {
  isSubjectAmbiguous: boolean;
  isGradeAmbiguous: boolean;
  isPolysemic: boolean;
  candidateSubjects?: string[];
}

export interface QueryUnderstanding {
  // === Phase 2 Structured Result ===
  normalizedQuery: string;
  language: LanguageCode;
  languageConfidence: number;

  subject?: string;
  subjectConfidence: number;
  subjectCandidates: SubjectCandidate[];

  grade?: string;
  gradeConfidence: number;

  intent: SearchIntent;
  intentConfidence: number;
  intentCandidates: IntentCandidate[];

  audience: AudienceMode;
  audienceConfidence: number;

  topic: string;
  topicConfidence: number;

  entities: QueryUnderstandingEntities;

  ambiguityFlags: QueryAmbiguityFlags;

  correctionSuggestions: string[];

  // === Backwards Compatibility Aliases ===
  normalized: NormalizedQuery;
  detectedLanguage: LanguageCode;
  detectedSubject?: string;
  detectedGrade?: string;
  detectedIntent: SearchIntent;
  extractedTopic: string;
  keywords: string[];
  isAmbiguous?: boolean;
  ambiguityTerm?: string;
  clarificationQuestion?: string;
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
      /(?:^|[^\p{L}\p{N}])(?:matematik[a-z]*|algebra[a-z]*|geometri[a-z]*|arifmetik[a-z]*|trigonometri[a-z]*|integral[a-z]*|differensial[a-z]*|математик[а-я]*|алгебр[а-я]*|геометр[а-я]*|арифметик[а-я]*|тригонометри[а-я]*|интеграл[а-я]*|дифференциал[а-я]*|дифференцир[а-я]*|mathematics?|math\b|calculus|geometry|algebra|arithmetic|trigonometry|quadratic equations?|linear equations?)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:kasr[a-z]*|tenglama[a-z]*|tengsizlik[a-z]*|natural son|butun son|ratsional son|haqiqiy son|oddiy kasr|o['‘`ʻ]nli kasr|burchak|uchburchak|to['‘`ʻ]rtburchak|doira|perimetr|yuzi|pifagor|viyet|diskriminant|kvadrat tenglama|birhad|ko['‘`ʻ]phad|arifmetik progressiya|geometrik progressiya|hosila|boshlang['‘`ʻ]ich funksiya|ehtimollar nazariyasi|matematik statistika|jadval|foiz|nisbat|proporsiya|ko['‘`ʻ]paytirish|bo['‘`ʻ]lish|qo['‘`ʻ]shish|ayirish|daraja|ildiz)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:дроб[а-я]*|дроби|уравнени[а-я]*|неравенств[а-я]*|числа|натуральн[а-я]*|целые числа|координат[а-я]*|функци[а-я]*|квадратичн[а-я]*|квадратн[а-я]*|корен[а-я]*|корни|производн[а-я]*|первообразн[а-я]*|пифагор[а-я]*|виет[а-я]*|дискриминант|дифференцир[а-я]*|комбинаторик[а-я]*|перестановк[а-я]*|сочетани[а-я]*|прямоугольн[а-я]* треугольник[а-я]*|умножени[а-я]*|делени[а-я]*|сложени[а-я]*|вычитани[а-я]*|прогресси[а-я]*|логарифм[а-я]*|sin|cos|tg|ctg|таблицу умножения)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:fractions?|equations?|pythagorean|theorem|quadratic|polynomials?|integers?|rational|linear|system|derivatives?|integrals?|logarithms?|logarithmic|exponential|matrices|matrix|probability|angles?|triangles?|mental calculation|addition|subtraction|multiplication|division|prime numbers?|composite numbers?|parabola|vertex)\b/i, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:drob[a-z]*|drobi|uravneni[a-z]*|diskriminant|pifagor|logarifm|funksiya|hosila|integral)(?=$|[^\p{L}\p{N}])/giu, weight: 0.8 },
    ],
  },
  {
    subject: "Ona tili",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:ona tili|grammatik[a-z]*|ona tilidan|она тили|русский язык|узбекский язык|uzbek language|mother tongue)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:so['‘`ʻ]z turkum[a-z]*|ot so['‘`ʻ]z|sifat so['‘`ʻ]z|fe['‘`ʻ]l|ravish|olmosh|son so['‘`ʻ]z|bog['‘`ʻ]lovchi|ko['‘`ʻ]makchi|yuklama|undov|sintaksis|gap b[o'‘`ʻ]?laklari|ega va kesim|bir tarkibli|qo['‘`ʻ]shma gap|ergashgan|bog['‘`ʻ]langan|fonetika|tovush|unli|undosh|so['‘`ʻ]z tarkibi|asos va qo['‘`ʻ]shimcha|matn tilshunosligi|uslubiyat|nutq madaniyati|notiqlik)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:существительн[а-я]*|прилагательн[а-я]*|глагол[а-я]*|наречи[а-я]*|местоимени[а-я]*|предлог[а-я]*|союз[а-я]*|частиц[а-я]*|подлежащ[а-я]*|сказуем[а-я]*|синтаксис|синтаксическ[а-я]*|односоставн[а-я]* предложени[а-я]*|стили речи|научный публицистический|культур[а-я]* речи|ораторск[а-я]* искусств[а-я]*|пунктуаци[а-я]*|орфографи[а-я]*|сложносочиненн[а-я]*|сложноподчиненн[а-я]*|части речи)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:grammar|syntax|phonetics|parts of speech|tenses|nouns?|verbs?|adjectives?|adverbs?)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Adabiyot",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:adabiyot[a-z]*|адабиёт[а-я]*|литератур[а-я]*|literature)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:xalq og['‘`ʻ]zaki ijodi|ertak[a-z]*|doston[a-z]*|she['‘`ʻ]r[a-z]*|g['‘`ʻ]azal[a-z]*|alisher navoiy|navoiy|bobur|cho['‘`ʻ]lpon|abdulla qodiriy|oybek|g['‘`ʻ]afur g['‘`ʻ]ulom|otkir hoshimov|badiiy asar|qahramon|ijodi|adabiy tahlil)(?=$|[^\p{L}\p{N}])/giu, weight: 0.95 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:капитанской дочке|стихотворени[а-я]*|произведени[а-я]*|классическ[а-я]*|пушкин|толстой|достоевский|анализ произведени[а-я]*|басни|поэзи[а-я]*|открытому уроку по литературе)(?=$|[^\p{L}\p{N}])/giu, weight: 0.95 },
      { pattern: /\b(?:oral presentation in literature|literature analysis|poetry|novel|fiction|folklore|fairy tales|literary works?)\b/i, weight: 0.95 },
    ],
  },
  {
    subject: "Fizika",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:fizik[a-z]*|физик[а-я]*|physics)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:mexanik[a-z]*|optik[a-z]*|termodinamik[a-z]*|dinamik[a-z]*|kinematik[a-z]*|bosim|zichlik|og['‘`ʻ]irlik|massa|tezlik|tezlanish|kuch|nyuton|paskal|arximed|om qonuni|amper|volt|tok kuchi|elektr zanjiri|magnit|diffuziya|issiqlik miqdori|solishtirma issiqlik|issiqlik sig['‘`ʻ]imi|fotoeffekt|yorug['‘`ʻ]lik)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:механик[а-я]*|оптик[а-я]*|термодинамик[а-я]*|динамик[а-я]*|кинематик[а-я]*|плотност[а-я]*|давлен[а-я]*|атмосферн[а-я]* давлен[а-я]*|опыт торричелли|почему небо голубое|скорост[а-я]*|ускорени[а-я]*|сил[а-я]*|ньютон[а-я]*|паскал[а-я]*|архимед[а-я]*|закон ома|закон паскаля|законы ньютона|электричеств[а-я]*|ток[а-я]*|магнитн[а-я]*|диффузи[а-я]*|теплоемкост[а-я]*|участок цепи)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:velocity|acceleration|speed|density|pressure|force|gravity|newton|newton's|pascal|pascal's|ohm|ohm's|thermodynamics|optics|electricity|heat capacity|kinetic|potential energy|buoyant force|archimedes)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Kimyo",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:kimyo[a-z]*|хими[а-я]*|chemistry|chemical)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:davriy jadval|davriy qonun|mendeleyev|mendeleev|atom tuzilishi|atom|molekula|modda|reaksiya|valentlik|valent|oksid[a-z]*|kislota[a-z]*|asos[a-z]*|(?:osh tuzi|tuzlar[a-z]*|tuzning|tuz hosil)|eritma[a-z]*|kislorod|vodorod|uglevodorod[a-z]*|organik kimyo|noorganik kimyo|anorganik|kimyoviy bog['‘`ʻ]lanish|kovalent|ionli|elektrolit|metallmas|polimer[a-z]*|molyar massa)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:периодическ[а-я]*|менделеев[а-я]*|строение атома|атом[а-я]*|молекул[а-я]*|веществ[а-я]*|реакци[а-я]*|валентност[а-я]*|оксид[а-я]*|кислот[а-я]*|основани[а-я]*|раствор[а-я]*|кислород[а-я]*|водород[а-я]*|химическ[а-я]* связ[а-я]*|молярная масса|лабораторной работы по химии)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:periodic table|atoms?|molecules?|reactions?|valence|valency|acids?|bases?|oxides?|solutions?|chemical bonds?|polymers?|molar mass|organic chemistry)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Biologiya",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:biolog[a-z]*|биолог[а-я]*|biology|biological)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:fotosintez|hujayra|nafas olish|botanik[a-z]*|zoologiy[a-z]*|anatomiy[a-z]*|odam anatomiyasi|qon aylanish|yurak|o['‘`ʻ]simlik|gul tuzilishi|ildiz|poya|barg|urug['‘`ʻ]|irsiyat|genetik[a-z]*|dnk|rnk|xromosoma|darvin|evolyutsiya|ekologiya|umurtqali|umurtqasiz|bakteriya|virus)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:фотосинтез[а-я]*|клетк[а-я]*|дыхани[а-я]*|ботаник[а-я]*|зоологи[а-я]*|анатоми[а-я]*|кровеносн[а-я]*|строени[а-я]* цветк[а-я]*|растени[а-я]*|наследственност[а-я]*|генетик[а-я]*|днк|рнк|эволюци[а-я]*|дарвин[а-я]*|микроскоп[а-я]*|нервн[а-я]* систем[а-я]*|головн[а-я]* мозг)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:photosynthesis|cells?|cell division|microscope|respiration|circulatory system|genetics?|dna|rna|evolution|darwin|botany|zoology|anatomy|plants?|organisms?|heredity|mitosis|meiosis|prophase|metaphase|anaphase|telophase)\b/i, weight: 0.95 },
    ],
  },
  {
    subject: "Tarix",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:tarix[a-z]*|тарих[а-я]*|истори[а-я]*|history|historical)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:jahon tarixi|o['‘`ʻ]zbekiston tarixi|qadimgi dunyo|sulola|jang|amir temur|temuriylar|bobur|boburiylar|somoniylar|qoraxoniylar|arxeologiya|ehromlar|misr|rim|gretsiya|kashfiyotlar|jadid|jadidchilik|mustaqillik)(?=$|[^\p{L}\p{N}])/giu, weight: 0.95 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:история древнего мира|древн[а-я]* мир[а-я]*|египетск[а-я]* пирамид[а-я]*|амир[а-я]* темур[а-я]*|государство амира темура|великие географические.*истори|эпоха возрождения.*истори|династи[а-я]*|битва|война)(?=$|[^\p{L}\p{N}])/giu, weight: 0.95 },
      { pattern: /\b(?:ancient rome|ancient egypt|pyramids?|alexander|temur|tamerlane|middle ages|renaissance|dynasty|empire|civilization|world history)\b/i, weight: 0.95 },
    ],
  },
  {
    subject: "Geografiya",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:geograf[a-z]*|географ[а-я]*|geography|geographic)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /(?:^|[^\p{L}\p{N}])(?:materik[a-z]*|okean[a-z]*|iqlim|xarita|globus|aholi|tabiiy zona|relyef|tog['‘`ʻ]lar|daryolar|afrika|yevrosiyo|amerika|antarktida|avstraliya|tabiiy geografiya)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:материк[а-я]*|океан[а-я]*|климатическ[а-я]*|климат[а-я]*|географическ[а-я]* карт[а-я]*|карт[а-я]*|населени[а-я]*|рельеф[а-я]*|еврази[а-я]*|африк[а-я]*)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
      { pattern: /\b(?:continents?|oceans?|climate|maps?|population|topography|equator|hemisphere)\b/i, weight: 0.9 },
    ],
  },
  {
    subject: "Informatika",
    strongPatterns: [
      /(?:^|[^\p{L}\p{N}])(?:informatik[a-z]*|информатик[а-я]*|informatics|computer science)(?=$|[^\p{L}\p{N}])/giu,
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
      /(?:^|[^\p{L}\p{N}])(?:ingliz tili|ingliz tilidan|английск[а-я]*|english language|english)(?=$|[^\p{L}\p{N}])/giu,
    ],
    keywordWeights: [
      { pattern: /\b(?:present simple|present continuous|present perfect|past simple|past continuous|future simple|tenses|irregular verbs|vocabulary|grammar exercises|parts of speech|nouns verbs adjectives)\b/i, weight: 0.95 },
      { pattern: /(?:^|[^\p{L}\p{N}])(?:inglizcha|grammatika ingliz|english grammar)(?=$|[^\p{L}\p{N}])/giu, weight: 0.9 },
    ],
  },
];

/** Intent markerlari va ularning confidence darajalari (Phase 12 Intent V3) */
const INTENT_PATTERNS: Array<{ intent: SearchIntent; confidence: number; patterns: RegExp[] }> = [
  {
    intent: "compare",
    confidence: 0.95,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:taqqosla[a-z]*|farqi|o['‘`ʻ]xshashligi|solishtir[a-z]*|farqlari|farqi nimada|сравни[а-я]*|сравнение|разниц[а-я]*|разница между|compare|difference between|\bvs\b)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "lesson_plan",
    confidence: 0.96,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:45 daqiqa|45 minutlik|45 minut|45 minutlik dars|dars ishlanma[a-z]*|dars reja[a-z]*|konspekt[a-z]*|texnologik xarita|поурочный план|поурочные разработки|план урока|конспект урока|lesson plan|teaching plan|lesson notes)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "presentation",
    confidence: 0.95,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:prezentatsiya[a-z]*|prizintatsiya[a-z]*|taqdimot[a-z]*|slayd[a-z]*|slayd tayyorla|slayd qilib ber|powerpoint|pptx|презентаци[а-я]*|слайд[а-я]*|географическая карта.*класс|presentation|slides)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "quiz_test",
    confidence: 0.94,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:\d+\s*ta\s*test(?:\s*tuz)?|test|testlar|viktorina|savol-javob|nazorat ishi|savollar tuz|savol qo['‘`ʻ]sh|yana \d+ ta savol|тест[а-я]*|вопросы к уроку|quiz|test questions|exam questions)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "solve",
    confidence: 0.94,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:yechib ber|yechish usuli|masalani yech|yechimi|qanday yechiladi|реши[а-я]*|решить задачу|как решить|solve|solution|how to solve)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "homework",
    confidence: 0.94,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:uyga vazifa|uy vazifam|uy vazifasi|mustaqil ish[a-z]*|домашнее задание|домашней работой|домашним заданием|домашняя работа|самостоятельная работа|homework|homework assignments?)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "worksheet",
    confidence: 0.92,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:mashq|mashqlar|topshiriq|topshiriqlar|tarqatma|amaliy ish|ish varag['‘`ʻ]?i|упражнени[а-я]*|задани[а-я]*|раздаточн[а-я]*|рабочий лист|worksheet|exercises)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "assessment",
    confidence: 0.92,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:baholash mezoni|baholash mezonlari|rubrika|kriteriya|baholash|оценивание|критерии оценивания|рубрика|assessment|rubric|grading)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "curriculum",
    confidence: 0.93,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:o['‘`ʻ]quv dasturi|davlat dasturi|soat|soati|ajratilgan soat|dts|standart|mavzular ketma-ketligi|taqsimot|kalendar reja[a-z]*|учебная программа|распределение часов|стандарт|календарный план|curriculum|syllabus|hours distribution)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "classroom_activity",
    confidence: 0.91,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:qanday metod|interaktiv usul|interfaol metod[a-z]*|metodika|o['‘`ʻ]yin|faoliyat|guruhlarda ishlash|guruhda ishlash|sinfda amaliy|amaliy mashg['‘`ʻ]?ulot[a-z]*|sinfda qo['‘`ʻ]llash|tajriba|laboratoriya mashg['‘`ʻ]uloti|laboratoriya|metodist|metodikasi|методика|игры на уроке|групповая работа|лабораторн[а-я]*|практическ[а-я]*|classroom activity|active learning|classroom management|teaching method|interactive math games)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "topic_search",
    confidence: 0.90,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:mavzusi|bobi bo['‘`ʻ]yicha|bo['‘`ʻ]yicha material|тема урока|обзор темы|topic overview|topic material)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "experiment",
    confidence: 0.92,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:tajriba o['‘`ʻ]tkazish|laboratoriya ishi|tajriba reja|fizik tajriba|kimyoviy tajriba|опыт|эксперимент|laboratory experiment|science experiment)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "translation",
    confidence: 0.93,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:tarjima qil|tarjimasi|inglizchaga o['‘`ʻ]gir|ruschaga o['‘`ʻ]gir|o['‘`ʻ]zbekchaga o['‘`ʻ]gir|переведи|перевод|translate into|translation of)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "fact_check",
    confidence: 0.91,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:to['‘`ʻ]g['‘`ʻ]rimi|rostmi|haqiqatmi|shundaymi|tekshirib ber|правда ли|верно ли|fact check|is it true)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "exam_prep",
    confidence: 0.94,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:imtihon[a-z]*|attestatsiya[a-z]*|olimpiada[a-z]*|olimpiada masalalari|yakuniy nazorat|davlat imtihoni|подготовка к экзамену|экзаменационн[а-я]*|олимпиадн[а-я]*|exam prep|olympiad|test prep)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "definition",
    confidence: 0.93,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:nima degani|qoidasi nima|ta['‘`ʻ]rifi|ta['‘`ʻ]rif|qoidasi|qoidalari|formula|formulasi|formulalari|что такое|определени[а-я]*|понятие|признаки|формул[а-я]*|definition of|meaning of|what is|rules|formulas?)(?=$|[^\p{L}\p{N}])/giu,
      /(?:^|[^\p{L}\p{N}])(?:[a-z'\p{L}]+\s+nima\??$)/iu,
    ],
  },
  {
    intent: "summarize",
    confidence: 0.91,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:qisqacha mazmuni|xulosa|xulosasi|xulosasini|umumlashtir|краткое содержание|итоги|вкратце|summarize|summary)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "example",
    confidence: 0.90,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:misol keltir|misollar|misollar bilan|namuna|namunalar|hayotiy misollar|yechimi bilan|yechimlari bilan|masalalar yechish|примеры|приведи пример|задачи с решениями|с решением|examples|sample|real world|worked examples?)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "explain",
    confidence: 0.88,
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:qanday ishlaydi|tushuntir[a-z]*|tushuntirish|tushuntirib ber|bolaga tushuntir|oddiy qilib ayt|sodda qilib tushuntir|mohiyati|объясни[а-я]*|как объяснить|как работает|explain|how it works|how to explain)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
];

/**
 * Matn tilini aniqlaydi (Uzbek, Russian, English).
 */
export function detectLanguage(text: string, fallback: LanguageCode = "UZ"): LanguageCode {
  // Rus tilida tushuntirish so'rovi
  if (/(?:^|[^\p{L}\p{N}])(?:rus tilida|по-русски)(?=$|[^\p{L}\p{N}])/iu.test(text)) {
    return "RU";
  }

  // 1. O'zbekcha o'ziga xos belgilar yoki kalit so'zlar
  if (
    /[ўқғҳ]|\b(?:o['‘`ʻ]|g['‘`ʻ])/i.test(text) ||
    /(?:^|[^\p{L}\p{N}])(?:dars|sinf|uchun|qanday|nima|ishlanma|reja|haqida|mavzu|tushuntir|o['‘`ʻ]quvchi|kasr|tenglama|mashq|amallar|so['‘`ʻ]z|bilan|yoki|ega|kesim|босим|мавзусига|синф|бўйича|ҳамда|tuz|tuzish|tuzib|savol|savollari|endi|yana)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "UZ";
  }

  // 2. Inglizcha kalit so'zlar va predloglar
  if (
    /\b(?:the|and|for|with|from|about|this|that|these|those|how|what|why|which|lesson|plan|grade|class|teach|teacher|student|students|explain|explanation|quiz|test|worksheet|activity|difference|between|formulas?|definition|questions?|summary|learning|solve|problems?|equations?|pythagorean|theorem|photosynthesis|mechanics|physics|chemistry|biology|math|mathematics|grammar|presentation|introduction|exercise|homework|chemical|bonds|covalent|ionic|overview|programming|conditional|statements|tutorial|division|stages|science|sorting|methods|assistant|hacker|unrestricted|you|are|longer|act|prompt|ignore|previous|rules)\b/i.test(text)
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
 * So'rovdan fanni aniqlaydi va confidence hamda nomzodlar bilan qaytaradi (Phase 5 & 11).
 */
export function detectSubjectDetails(
  text: string,
  rawText?: string,
  language: LanguageCode = "UZ",
): {
  subject?: string;
  confidence: number;
  candidates: SubjectCandidate[];
  isAmbiguous?: boolean;
  ambiguityTerm?: string;
  clarificationQuestion?: string;
} {
  // Avval ko'p ma'noli so'zlar tekshiruvi (Ambiguity Engine V2 — Phase 11)
  const disambiguation = resolveAmbiguity(text, language) ?? (rawText ? resolveAmbiguity(rawText, language) : null);
  if (disambiguation) {
    if (disambiguation.resolvedSubject) {
      return {
        subject: disambiguation.resolvedSubject,
        confidence: disambiguation.candidates[0]?.confidence ?? 0.90,
        candidates: disambiguation.candidates,
        isAmbiguous: false,
      };
    }
    return {
      subject: undefined,
      confidence: disambiguation.candidates?.[0]?.confidence ?? 0.50,
      candidates: disambiguation.candidates,
      isAmbiguous: disambiguation.isAmbiguous,
      ambiguityTerm: disambiguation.term,
      clarificationQuestion: disambiguation.clarificationQuestion,
    };
  }

  const scores: Record<string, number> = {};

  for (const def of SUBJECT_DEFINITIONS) {
    let score = 0;

    // Kuchli patternlar (fanning aniq nomi kelsa)
    for (const pat of def.strongPatterns) {
      pat.lastIndex = 0;
      const m1 = pat.test(text);
      pat.lastIndex = 0;
      const m2 = rawText ? pat.test(rawText) : false;
      pat.lastIndex = 0;
      if (m1 || m2) {
        score += 5.0; // Aniq fan nomi kelsa, hal qiluvchi kuchga ega
      }
    }

    // Kalit so'zlar bo'yicha vaznlar
    for (const kw of def.keywordWeights) {
      kw.pattern.lastIndex = 0;
      const m1 = kw.pattern.test(text);
      kw.pattern.lastIndex = 0;
      const m2 = rawText ? kw.pattern.test(rawText) : false;
      kw.pattern.lastIndex = 0;
      if (m1 || m2) {
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
      confidence: Math.min(1.0, Number((rawScore / (rawScore + 0.3)).toFixed(2))),
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
  // Agar eng yuqori ishonch >= 0.50 bo'lsa, aniq fan sifatida qabul qilamiz
  if (top.confidence >= 0.50) {
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
  const m1 = text.match(/(?:^|[^\p{L}\p{N}])([1-9]|1[0-1])(?:th|st|nd|rd)?\s*[-_]?\s*(?:sinf|синф|class|grade|класс)(?:[a-z'\p{L}]*)?(?=$|[^\p{L}\p{N}])/iu);
  if (m1) {
    return `${m1[1]}-sinf`;
  }

  const m2 = text.match(/(?:^|[^\p{L}\p{N}])(?:sinf|синф|class|grade|класс)\s*[-_]?\s*([1-9]|1[0-1])(?:th|st|nd|rd)?(?=$|[^\p{L}\p{N}])/iu);
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
      pattern.lastIndex = 0;
      const m1 = pattern.test(text);
      pattern.lastIndex = 0;
      const m2 = rawText ? pattern.test(rawText) : false;
      pattern.lastIndex = 0;
      if (m1 || m2) {
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
 * Auditoriyani aniqlaydi (o'qituvchi yoki o'quvchi) va ishonch ko'rsatkichini hisoblaydi (Phase 13).
 */
export function detectAudienceDetails(
  text: string,
  intent: SearchIntent,
): { audience: AudienceMode; confidence: number } {
  // 1. O'quvchiga xos so'rovlar (bolaga tushuntirish, sodda so'zlar, o'quvchi uchun)
  if (
    intent === "homework" ||
    intent === "solve" ||
    /(?:^|[^\p{L}\p{N}])(?:bolaga[a-z]*|oddiy qilib|sodda qilib|sodda tushuntir|menga tushunarsiz|tushunmadim|o['‘`ʻ]quvchiman|masalani yech|uy vazifam|maktabdaman|javobini top|простыми словами|для учеников|я ученик|школьник|домашнее задание|не понял|помогите решить|for students?|i am a student|help with my homework)(?=$|[^\p{L}\p{N}])/giu.test(
      text,
    )
  ) {
    return { audience: "student", confidence: 0.92 };
  }

  // 2. O'qituvchiga xos so'rovlar (metodik, dars ishlanma, baholash)
  if (
    intent === "lesson_plan" ||
    intent === "presentation" ||
    intent === "curriculum" ||
    intent === "classroom_activity" ||
    intent === "assessment" ||
    /(?:^|[^\p{L}\p{N}])(?:o['‘`ʻ]qituvchi|sinfda|darsga|o['‘`ʻ]quvchilarga|baholash|konspekt|metodist|dars ishlanma|учителю|на уроке|методика|поурочный|lesson plan|classroom|teaching|teacher)(?=$|[^\p{L}\p{N}])/giu.test(
      text,
    )
  ) {
    return { audience: "teacher", confidence: 0.95 };
  }

  // Ambiguous holatda ishonch past bo'ladi (Phase 13)
  return { audience: "teacher", confidence: 0.60 };
}

export function detectAudience(text: string, intent: SearchIntent): AudienceMode {
  return detectAudienceDetails(text, intent).audience;
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
    /(?:^|[^\p{L}\p{N}])(?:uchun|haqida|nima|nima degani|qanday|qanday ishlaydi|tushuntir|tushuntirish|tushuntirib ber|ber|kerak|qilish|qil|qilib|tuz|tuzib|tayyorla|tayyorlab|yoz|yozib|ko['‘`ʻ]rsat|endi|yana|dars|ishlanma|dars ishlanma|dars ishlanmasi|dars reja|reja|slayd|slaydlar|prezentatsiya|taqdimot|test|testlar|savol|savollar|metod|metodika|mavzusi|mavzusini|mavzuda|qoidasi|ta['‘`ʻ]rifi|konspekt|turi|turlari|qisqa|yechib ber|masalani yech|yech|yechimi|uyga vazifa|uy vazifam|baholash|misol|misollar|namuna|xulosa|для|как|план|урока|поурочный|слайды|тест|вопросы|упражнения|конспект|задания|еще|сделай|напиши|по|на|в|из|с|со|к|реши|решить|домашнее|задание|примеры|lesson|plan|slides|presentation|quiz|worksheet|explain|how to|solve|homework|assessment|for|and|the|with|of|to|in|at|on|questions?|exercises?|summary|sheet)(?=$|[^\p{L}\p{N}])/giu,
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

  const subjectDetails = detectSubjectDetails(normalized.normalized, rawQuery, detectedLanguage);
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

  const audDetails = detectAudienceDetails(normalized.normalized, detectedIntent);
  const audience = audDetails.audience;
  const audienceConfidence = audDetails.confidence;

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

  const correctionSuggestions = getCorrectionSuggestions(rawQuery);

  const entities: QueryUnderstandingEntities = {
    terms: keywords,
    gradeMentions: detectedGrade ? [detectedGrade] : [],
    subjectMentions: detectedSubject ? [detectedSubject] : [],
    keywords,
  };

  const ambiguityFlags: QueryAmbiguityFlags = {
    isSubjectAmbiguous: Boolean(subjectDetails.isAmbiguous),
    isGradeAmbiguous: !detectedGrade,
    isPolysemic: Boolean(subjectDetails.ambiguityTerm),
    candidateSubjects: subjectCandidates.map((c) => c.subject),
  };

  const intentCandidates: IntentCandidate[] = [
    { intent: detectedIntent, confidence: intentConfidence },
  ];

  return {
    // === Phase 2 Structured Result ===
    normalizedQuery: normalized.normalized,
    language: detectedLanguage,
    languageConfidence: detectedLanguage === "UZ" ? 0.99 : 0.98,

    subject: detectedSubject,
    subjectConfidence,
    subjectCandidates,

    grade: detectedGrade,
    gradeConfidence: detectedGrade ? 0.98 : 0.0,

    intent: detectedIntent,
    intentConfidence,
    intentCandidates,

    audience,
    audienceConfidence,

    topic: extractedTopic,
    topicConfidence: extractedTopic.length >= 3 ? 0.92 : 0.50,

    entities,
    ambiguityFlags,
    correctionSuggestions,

    // === Backwards Compatibility Aliases ===
    normalized,
    detectedLanguage,
    detectedSubject,
    detectedGrade,
    detectedIntent,
    extractedTopic,
    keywords,
    isAmbiguous: subjectDetails.isAmbiguous,
    ambiguityTerm: subjectDetails.ambiguityTerm,
    clarificationQuestion: subjectDetails.clarificationQuestion,
  };
}
