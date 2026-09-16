/**
 * Content-Security-Policy — XSS va kod in'yeksiyasiga qarshi asosiy to'siq.
 *
 * ── Nega nonce, `'unsafe-inline'` emas ────────────────────────────────────
 * Next.js sahifaga o'z inline skriptlarini joylaydi (RSC oqimi, ilova
 * yuklagichi). Ularni CSP'dan o'tkazishning ikki yo'li bor:
 *
 *  1. `script-src 'unsafe-inline'` — hamma inline skriptga ruxsat. Oson,
 *     lekin CSP'ning XSS'dan himoya qiladigan asosiy qismini o'chiradi:
 *     hujumchi sahifaga kiritgan skript ham shu ruxsatga tushadi.
 *
 *  2. NONCE — har so'rovda yangi tasodifiy qiymat. Faqat SHU qiymatga ega
 *     skript ishlaydi. Hujumchi nonce'ni oldindan bila olmaydi.
 *
 * Ikkinchisi tanlandi. Odatda uning narxi bor: nonce har so'rovda
 * o'zgargani uchun sahifalar STATIK bo'la olmaydi. Bu ilovada esa
 * narx NOLGA teng — `next build` natijasida barcha yo'llar allaqachon
 * dinamik (`ƒ`), chunki til har so'rovda cookie'dan aniqlanadi.
 *
 * Next.js nonce'ni CSP sarlavhasidan O'ZI o'qiydi va o'z skriptlariga
 * qo'yadi — qo'lda hech narsa qilish kerak emas.
 *
 * ── `'strict-dynamic'` nima qiladi ────────────────────────────────────────
 * Nonce'li skript yuklagan skriptlarga ham ishonadi. Next ilovaning
 * qolgan bo'laklarini shu yo'l bilan yuklaydi, ya'ni ularning har birini
 * alohida ro'yxatga olish kerak emas.
 *
 * ── Ishlab chiqish muhitidagi yon berishlar ───────────────────────────────
 * `'unsafe-eval'` — React dev rejimida xato izlarini tiklash uchun `eval`
 * ishlatadi. `'unsafe-inline'` (style uchun) — dev serverida CSS JS orqali
 * joylanadi. Ikkalasi ham FAQAT `NODE_ENV=development` da qo'shiladi.
 */

/**
 * Har so'rov uchun yangi nonce.
 *
 * `crypto.randomUUID()` kriptografik jihatdan mustahkam generator —
 * `Math.random()` dan farqli o'laroq uni taxmin qilib bo'lmaydi.
 */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * CSP sarlavhasining qiymatini yig'adi.
 *
 * @param nonce - shu so'rov uchun yaratilgan qiymat
 * @param isDev - ishlab chiqish muhitidami (dev serveri yon berish talab qiladi)
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: string[] = [
    // Quyida alohida aytilmagan hamma narsa — faqat o'z domenimizdan.
    "default-src 'self'",

    // Skriptlar: faqat nonce'li va ular yuklaganlari.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,

    /*
      Uslublar.

      Productionda Tailwind bitta CSS faylga yig'iladi (`'self'`), Next
      esa o'z inline `<style>` bloklariga nonce qo'yadi. Dev serverida
      CSS JS orqali joylanadi va unda nonce bo'lmaydi — shuning uchun
      faqat o'sha yerda `'unsafe-inline'`.
    */
    `style-src 'self'${isDev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,

    /*
      `style` ATRIBUTI — alohida direktiva.

      Nonce atributga qo'llanmaydi, `style-src` esa uni qamrab oladi.
      Ilovada bir nechta joyda hisoblangan uslub bor: bosh sahifa foni
      (gradient), generatsiya progress chizig'ining eni, slayd namunasi.
      Ularsiz sahifa buziladi.

      Xavfsizlik jihatidan bu yon berish arzon: `style` atributi kod
      BAJARMAYDI, u faqat ko'rinishni o'zgartiradi.
    */
    "style-src-attr 'unsafe-inline'",

    /*
      Rasmlar: `data:` — rasm tahlili modulida tanlangan surat
      `FileReader` orqali data URI sifatida ko'rsatiladi.
    */
    "img-src 'self' data: blob:",

    // Shriftlar `next/font` orqali O'ZIMIZDA joylashgan (Geist).
    "font-src 'self'",

    /*
      Tarmoq so'rovlari. Dev serverida HMR WebSocket ishlatadi —
      ba'zi brauzerlarda `'self'` `ws:` ni qamrab olmaydi.
    */
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,

    // Flash/Java kabi plaginlar umuman kerak emas.
    "object-src 'none'",

    // <base href> bilan nisbiy havolalarni begona domenga burib bo'lmasin.
    "base-uri 'self'",

    // Formalar faqat o'zimizga yuborilsin (ma'lumot o'g'irlashning oldini oladi).
    "form-action 'self'",

    // Saytni <iframe> ichiga joylab bo'lmasin (clickjacking).
    "frame-ancestors 'none'",
  ];

  /*
    HTTP resurslarni avtomatik HTTPS'ga ko'taradi.

    Faqat productionda: mahalliy serverda sayt `http://localhost` orqali
    ochiladi va bu direktiva uni buzishi mumkin.
  */
  if (!isDev) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

/** Nonce shu sarlavha orqali render qatlamiga uzatiladi. */
export const NONCE_HEADER = "x-nonce";
