/**
 * Xavfsizlik sarlavhalari — YAGONA manba.
 *
 * ── Nega ilovada, Nginx'da emas ───────────────────────────────────────────
 * Ilgari ular faqat `nginx/snippets/security-headers.conf` da edi va
 * shu sababli JIM yo'qolgan: Nginx'da `add_header` MEROS OLINMAYDI, o'z
 * `add_header` i bor har bir `location` ota-blokdagilarni bekor qiladi.
 * Yakuniy `location /` da esa snippet `include` qilinmagan — ya'ni
 * HAMMA HTML sahifa (login, dashboard, natijalar) sarlavhasiz ketardi.
 * Statik fayllar va generatsiya API'si esa ularni olardi.
 *
 * Bunday nosozlikni ko'z bilan sezish deyarli imkonsiz. Shuning uchun
 * qoida ilovaning o'ziga ko'chirildi: u proksi sozlamasiga bog'liq emas,
 * mahalliy ishlab chiqishda ham, Docker'da ham, VPS'da ham bir xil
 * ishlaydi va sinov bilan tekshiriladi.
 *
 * ── Nega HSTS bu yerda YO'Q ───────────────────────────────────────────────
 * `Strict-Transport-Security` faqat HTTPS javobida ma'noga ega va uni
 * TLS'ni tugatadigan qatlam berishi to'g'ri — ya'ni Nginx. Bu yerda ham
 * qo'shsak, productionda sarlavha IKKI marta ketardi.
 * Qarang: `nginx/snippets/security-headers.conf`.
 *
 * ── CSP nega bu yerda emas ────────────────────────────────────────────────
 * CSP har so'rovda YANGI nonce talab qiladi, `next.config.ts` dagi
 * sarlavhalar esa statik. Shuning uchun u `proxy.ts` da —
 * `lib/security/csp.ts` ga qarang.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export const SECURITY_HEADERS: readonly SecurityHeader[] = [
  /*
    Brauzer fayl turini "taxmin qilmasin".

    Bizda muhim: yuklab olish route'lari .pptx/.xlsx/.docx qaytaradi va
    sniffing yoqilgan brauzer ularning ichidagi matnni HTML deb talqin
    qilishga urinishi mumkin edi.
  */
  { key: "X-Content-Type-Options", value: "nosniff" },

  /*
    Saytni begona sahifa ichiga <iframe> qilib qo'yib bo'lmasin
    (clickjacking). CSP'dagi `frame-ancestors` shu vazifani bajaradi,
    lekin bu sarlavha eski brauzerlar uchun ham ishlaydi.
  */
  { key: "X-Frame-Options", value: "DENY" },

  /*
    Boshqa saytga o'tilganda to'liq manzil yuborilmasin.

    Bizda dars ishlanmasi manzilida id bor (`/dashboard/lesson-plans/<id>`)
    — u begona saytning loglariga tushmasligi kerak.
  */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  /*
    Kerak bo'lmagan brauzer imkoniyatlarini o'chiramiz.

    Kamera ATAYLAB `self`: rasm tahlili moduli telefon kamerasidan
    surat oladi (`components/vision/image-analyzer.tsx`).
  */
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },

  /*
    Saytlararo ma'lumot sizishiga qarshi qo'shimcha qatlam: bu hujjatni
    boshqa origin bilan bir jarayonda ochishga yo'l qo'ymaydi.
  */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },

  /*
    Bizning resurslarimizni begona sayt o'z sahifasiga yuklay olmasin.
    `same-site` tanlandi (`same-origin` emas): kelajakda statik fayllar
    subdomenga ko'chirilsa ham buzilmaydi.
  */
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];
