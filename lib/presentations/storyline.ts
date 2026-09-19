/**
 * STORYLINE DVIGATELI — prezentatsiyaning HIKOYA SKELETI.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Phase 1 dan keyin slaydlar chiroyli ko'rinardi, lekin ULAR ORASIDA
 * BOG'LIQLIK yo'q edi. AI'ga "AI haqida prezentatsiya qil" desangiz, u
 * sakkizta mustaqil "AI haqida qiziqarli faktlar" slaydini qaytarardi.
 * Tomoshabin uchun bu ro'yxat, hikoya emas.
 *
 * Gamma kabi mahsulotlarning asosiy farqi ham shu: ular avval NIMA UCHUN
 * har bir slayd borligini hal qiladi, keyin unga matn yozadi.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * Har bir prezentatsiya ARXETIP tanlaydi (ta'limiy, investor, biznes,
 * hisobot) va arxetip BEATlar ketma-ketligini beradi. Beat — slaydning
 * hikoyadagi VAZIFASI: "muammoni ko'rsat", "yechimni tanishtir",
 * "dalil keltir".
 *
 * AI keyin har bir beat uchun matn yozadi. Ya'ni AI mazmunni o'ylaydi,
 * TARTIBNI esa bu yerdagi deterministik qoidalar belgilaydi. Shuning
 * uchun bir xil so'rov har doim bir xil skeletni beradi va uni test
 * bilan qulflash mumkin.
 *
 * ── Nega beatlar ro'yxati qat'iy emas ─────────────────────────────────────
 * Slaydlar soni foydalanuvchidan yoki mavzu kengligidan keladi va u
 * arxetipdagi beatlar soniga MOS KELMASLIGI mumkin. Shuning uchun
 * `planStoryline` ro'yxatni aynan kerakli songa moslaydi: kam bo'lsa eng
 * kam ahamiyatli beatlar tushiriladi, ko'p bo'lsa takrorlanishi mumkin
 * bo'lgan beatlar bo'linadi.
 */

/** Hikoya arxetipi — prezentatsiyaning umumiy shakli. */
export const STORYLINE_ARCHETYPES = [
  "educational",
  "investor",
  "business",
  "report",
] as const;

export type StorylineArchetype = (typeof STORYLINE_ARCHETYPES)[number];

/**
 * Mazmun SHAKLI — slaydda ma'lumot qanday joylashadi.
 *
 * DIQQAT: bu MAKET EMAS. Maketni Phase 1 dvigateli (`layout-engine.ts`)
 * mazmundan keltirib chiqaradi. Bu yerda faqat "bu slaydda uchta
 * tushuncha bo'ladi" degan mazmuniy qaror bor; uni uch ustunli maketga
 * aylantirish — renderer qatlamining ishi.
 */
export const CONTENT_TYPES = [
  "statement",
  "bullets",
  "cards",
  "steps",
  "comparison",
  "statistic",
  "chart",
  "quote",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/** Hikoyaning bitta bosqichi. */
export interface StorylineBeat {
  /** Barqaror kalit — testlar va planner shu bo'yicha ishlaydi. */
  key: string;
  /** Beat NIMA UCHUN kerakligi — promptga ham shu matn ketadi. */
  purpose: string;
  /** Slaydning hikoyadagi o'rni. */
  role: "open" | "develop" | "evidence" | "close";
  /**
   * Beat tushirilishi mumkinmi.
   *
   * Kichikroq (muqova) va yakuniy beatlarsiz prezentatsiya buziladi,
   * shuning uchun ular hech qachon tushmaydi.
   */
  required: boolean;
  /**
   * Beat takrorlanishi mumkinmi — slaydlar soni beatlar sonidan ko'p
   * bo'lganda kengaytirish uchun. "Muammo" slaydini ikkiga bo'lish
   * tabiiy, "Muqova" ni esa yo'q.
   */
  expandable: boolean;
  /** Bu beatga eng mos mazmun shakli — AI uchun TAVSIYA, buyruq emas. */
  suggested: ContentType;
}

/** Muqova — barcha arxetiplarda bir xil va har doim birinchi. */
const COVER_BEAT: StorylineBeat = {
  key: "cover",
  purpose: "Mavzuni va prezentatsiyaning va'dasini bir jumlada e'lon qilish",
  role: "open",
  required: true,
  expandable: false,
  suggested: "statement",
};

/**
 * Arxetiplar.
 *
 * Ketma-ketlik MUHIM — bu hikoyaning tartibi. Ro'yxatlar foydalanuvchi
 * bergan spetsifikatsiyadan olingan.
 */
const ARCHETYPE_BEATS: Record<StorylineArchetype, StorylineBeat[]> = {
  /*
    Ta'limiy: savoldan boshlanadi, chunki o'quvchi javobni bilishni
    xohlamasa, qolgan hamma narsa yodlashga aylanadi.
  */
  educational: [
    {
      key: "question",
      purpose: "Darsni boshlaydigan savol — o'quvchida qiziqish uyg'otish",
      role: "open",
      required: true,
      expandable: false,
      suggested: "statement",
    },
    {
      key: "context",
      purpose: "Mavzu qayerda uchraydi va nega ahamiyatli",
      role: "develop",
      required: false,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "concept",
      purpose: "Asosiy tushunchaning ta'rifi",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "cards",
    },
    {
      key: "how-it-works",
      purpose: "Jarayon qanday kechadi — bosqichma-bosqich",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "steps",
    },
    {
      key: "example",
      purpose: "Hayotdan olingan aniq misol",
      role: "evidence",
      required: true,
      expandable: true,
      suggested: "bullets",
    },
    {
      key: "evidence",
      purpose: "Tushunchani tasdiqlovchi dalil yoki kuzatish",
      role: "evidence",
      required: false,
      expandable: true,
      suggested: "bullets",
    },
    {
      key: "application",
      purpose: "O'quvchi buni qayerda ishlatadi — amaliy topshiriq",
      role: "develop",
      required: false,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "summary",
      purpose: "Darsning asosiy xulosasi — yodda qoladigan fikr",
      role: "close",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
  ],

  investor: [
    {
      key: "problem",
      purpose: "Hal qilinayotgan muammo va u kimga tegishli",
      role: "open",
      required: true,
      expandable: true,
      suggested: "statement",
    },
    {
      key: "why-now",
      purpose: "Nega aynan hozir — bozordagi o'zgarish",
      role: "develop",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "solution",
      purpose: "Taklif etilayotgan yechim",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "cards",
    },
    {
      key: "market",
      purpose: "Bozor hajmi va maqsadli segment",
      role: "evidence",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "product",
      purpose: "Mahsulot qanday ishlaydi",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "steps",
    },
    {
      key: "business-model",
      purpose: "Daromad qanday shakllanadi",
      role: "develop",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "competition",
      purpose: "Raqobatchilar va farqlovchi ustunlik",
      role: "evidence",
      required: false,
      expandable: false,
      suggested: "comparison",
    },
    {
      key: "traction",
      purpose: "Hozirgacha erishilgan natijalar",
      role: "evidence",
      required: false,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "roadmap",
      purpose: "Keyingi bosqichlar va muddatlar",
      role: "develop",
      required: false,
      expandable: false,
      suggested: "steps",
    },
    {
      key: "ask",
      purpose: "Investordan nima so'ralmoqda va mablag' nimaga ketadi",
      role: "close",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
  ],

  business: [
    {
      key: "context",
      purpose: "Hozirgi holat — barcha bir xil manzarani ko'rishi uchun",
      role: "open",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "problem",
      purpose: "Nima ishlamayapti va buning narxi",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "statement",
    },
    {
      key: "insight",
      purpose: "Masalaga yangi qarash — qarorning asosi",
      role: "develop",
      required: true,
      expandable: false,
      suggested: "statement",
    },
    {
      key: "solution",
      purpose: "Taklif etilayotgan yechim",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "cards",
    },
    {
      key: "evidence",
      purpose: "Yechimni qo'llab-quvvatlovchi dalil",
      role: "evidence",
      required: false,
      expandable: true,
      suggested: "bullets",
    },
    {
      key: "impact",
      purpose: "Kutilayotgan natija",
      role: "evidence",
      required: false,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "next-steps",
      purpose: "Kim, nima va qachon qiladi",
      role: "close",
      required: true,
      expandable: false,
      suggested: "steps",
    },
  ],

  report: [
    {
      key: "executive-summary",
      purpose: "Butun hisobotning xulosasi — birinchi slaydda",
      role: "open",
      required: true,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "data",
      purpose: "Hisobot asoslangan ma'lumot",
      role: "evidence",
      required: true,
      expandable: true,
      suggested: "bullets",
    },
    {
      key: "findings",
      purpose: "Ma'lumotdan chiqqan asosiy topilmalar",
      role: "evidence",
      required: true,
      expandable: true,
      suggested: "cards",
    },
    {
      key: "analysis",
      purpose: "Topilmalar nimani anglatadi",
      role: "develop",
      required: true,
      expandable: true,
      suggested: "bullets",
    },
    {
      key: "implications",
      purpose: "Bu natijalar kimga va qanday ta'sir qiladi",
      role: "develop",
      required: false,
      expandable: false,
      suggested: "bullets",
    },
    {
      key: "recommendations",
      purpose: "Nima qilish tavsiya etiladi",
      role: "close",
      required: true,
      expandable: false,
      suggested: "steps",
    },
  ],
};

/** Arxetipning tabiiy uzunligi — muqova bilan birga. */
export function naturalSlideCount(archetype: StorylineArchetype): number {
  return ARCHETYPE_BEATS[archetype].length + 1;
}

/** Arxetip uchun eng kichik mumkin bo'lgan slaydlar soni (majburiy beatlar). */
export function minimumSlideCount(archetype: StorylineArchetype): number {
  return ARCHETYPE_BEATS[archetype].filter((beat) => beat.required).length + 1;
}

/**
 * Berilgan songa AYNAN mos hikoya rejasini quradi.
 *
 * ── Nega "aynan" muhim ────────────────────────────────────────────────────
 * Foydalanuvchi "10 ta slayd" desa, 9 yoki 11 ta slayd — nuqson. Ilgari
 * bu shart faqat promptda aytilardi va model uni tez-tez buzardi.
 * Endi son STRUKTURADAN kelib chiqadi: nechta beat bo'lsa, shuncha
 * slayd bo'ladi, AI esa faqat matn yozadi.
 *
 * ── Qisqartirish tartibi ──────────────────────────────────────────────────
 * Ixtiyoriy beatlar OXIRIDAN boshlab tushiriladi: hikoyaning boshi
 * (muammo, tushuncha) oxiridagi qo'shimchalardan (yo'l xaritasi,
 * qo'llanish) ko'ra muhimroq.
 *
 * ── Kengaytirish tartibi ──────────────────────────────────────────────────
 * `expandable` beatlar navbat bilan takrorlanadi. Takrorlangan beat
 * `part` raqamini oladi — AI promptda "bu mavzuning 2-qismi" ekanini
 * ko'radi va matnni takrorlamaydi.
 */
export interface PlannedBeat extends StorylineBeat {
  /** Takrorlangan beatning qismi (1 dan boshlanadi). Takrorlanmasa 1. */
  part: number;
  /** Beat necha qismga bo'lingan. Bo'linmasa 1. */
  parts: number;
}

export function planStoryline(
  archetype: StorylineArchetype,
  slideCount: number,
): PlannedBeat[] {
  const beats = ARCHETYPE_BEATS[archetype];

  /*
    Muqova alohida hisoblanadi — u arxetipga bog'liq emas va hech qachon
    tushmaydi. Qolgan slaydlar beatlar orasida taqsimlanadi.
  */
  const bodyCount = Math.max(1, slideCount - 1);

  let selected: StorylineBeat[];

  if (bodyCount >= beats.length) {
    selected = expandBeats(beats, bodyCount);
  } else {
    selected = shrinkBeats(beats, bodyCount);
  }

  const withCover = [COVER_BEAT, ...selected];

  // Takrorlangan beatlar uchun qism raqamlarini qo'yamiz.
  const totals = new Map<string, number>();
  for (const beat of withCover) {
    totals.set(beat.key, (totals.get(beat.key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();

  return withCover.map((beat) => {
    const part = (seen.get(beat.key) ?? 0) + 1;
    seen.set(beat.key, part);
    return { ...beat, part, parts: totals.get(beat.key) ?? 1 };
  });
}

/** Kerakli songa QISQARTIRISH — ixtiyoriylarni oxiridan tushiramiz. */
function shrinkBeats(beats: StorylineBeat[], target: number): StorylineBeat[] {
  const keep = beats.map(() => true);
  let count = beats.length;

  for (let index = beats.length - 1; index >= 0 && count > target; index--) {
    if (beats[index].required) continue;
    keep[index] = false;
    count--;
  }

  const kept = beats.filter((_, index) => keep[index]);

  /*
    Majburiy beatlar SONIDAN ham kam so'ralgan bo'lsa (masalan investor
    arxetipi uchun 4 slayd), oxirgi beatni saqlagan holda oldindan
    kesamiz: yakunsiz prezentatsiya yakunsiz hikoya bo'lardi.
  */
  if (kept.length <= target) return kept;

  const last = kept[kept.length - 1];
  return [...kept.slice(0, target - 1), last];
}

/** Kerakli songa KENGAYTIRISH — bo'linadigan beatlarni navbat bilan takrorlaymiz. */
function expandBeats(beats: StorylineBeat[], target: number): StorylineBeat[] {
  const result = [...beats];
  const expandable = beats.filter((beat) => beat.expandable);

  // Bo'linadigan beat umuman bo'lmasa — bor narsani qaytaramiz. Bu holat
  // slaydlar sonining yuqori chegarasi bilan oldini olinadi, lekin
  // funksiya o'zi ham yiqilmasligi kerak.
  if (expandable.length === 0) return result;

  let cursor = 0;
  while (result.length < target) {
    const source = expandable[cursor % expandable.length];
    cursor++;

    // Takrorni ASLINING ORTIDAN qo'yamiz — hikoya tartibi buzilmasin.
    const lastIndexOfSource = result.map((beat) => beat.key).lastIndexOf(source.key);
    result.splice(lastIndexOfSource + 1, 0, source);
  }

  return result;
}

/** Beat ro'yxatidan slayd turlarini keltirib chiqaradi. */
export function slideTypeForBeat(
  index: number,
  total: number,
): "title" | "content" | "summary" {
  if (index === 0) return "title";
  if (index === total - 1) return "summary";
  return "content";
}
