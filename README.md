# Searcher AI

O'qituvchilar uchun AI-yordamchi platforma: dars ishlanmasi, prezentatsiya
(.pptx), Excel reja va ko'p tilli kontent generatsiyasi.

**Jamoa:** Expelled Coders · **Topshirish muddati:** 05.10.2026

---

## Stack

| Qatlam | Texnologiya |
| --- | --- |
| Frontend + Backend | Next.js 16 (App Router, Turbopack) |
| Til | TypeScript |
| Uslub | Tailwind CSS 4 |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) |
| Baza | PostgreSQL 18 |
| Validatsiya | zod 4 |
| AI | provider-agnostik qatlam — OpenAI-mos yoki Anthropic |

---

## Ishga tushirish

### 1. Bog'liqliklar

```bash
npm install
```

> `postinstall` avtomatik `prisma generate` ni ishga tushiradi — Prisma
> klienti git'ga tushmaydi, shuning uchun toza klonda uni yaratish shart.

### 2. Muhit o'zgaruvchilari

```bash
cp .env.example .env
```

Keyin `.env` ni tahrirlang. **Ikki o'zgaruvchi MAJBURIY:**

| O'zgaruvchi | Nima qilish kerak |
| --- | --- |
| `DATABASE_URL` | 3-qadamdagi variantga mos qiymatni qo'ying |
| `AUTH_SECRET` | Yarating: `openssl rand -base64 48` |

`AUTH_SECRET` bo'lmasa ilova ishga tushmaydi (sozlama xatosi bilan
to'xtaydi). `AI_API_KEY` esa ixtiyoriy: bo'lmasa ilova ishlaydi va
sahifalar ochiladi, faqat generatsiya «AI xizmati sozlanmagan» xatosi
bilan tugaydi.

To'liq ro'yxat — «Muhit o'zgaruvchilari» bo'limida.

### 3. Ma'lumotlar bazasi

Ikki variantdan bittasini tanlang.

**A) Docker (tavsiya etiladi)** — host portida `5433`:

```bash
docker compose up -d
```

`.env` da:

```
DATABASE_URL="postgresql://searcher:searcher_dev_password@localhost:5433/searcher_ai?schema=public"
```

**B) Mahalliy PostgreSQL** — host portida `5432`:

```bash
psql -U postgres -c "CREATE ROLE searcher LOGIN PASSWORD 'searcher_dev_password' CREATEDB"
psql -U postgres -c "CREATE DATABASE searcher_ai OWNER searcher"
```

### 4. Migratsiya

```bash
npm run db:migrate
```

### 5. Ishga tushirish

```bash
npm run dev
```

Tekshirish: <http://localhost:3000/api/health>

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "database": { "connected": true, "latencyMs": 56 },
    "ai": { "provider": "openai", "model": "gpt-4o-mini", "configured": false },
    "storage": { "driver": "local" }
  }
}
```

`ai.configured: false` — kalit qo'yilmagan. Generatsiyani sinash uchun
`.env` ga `AI_API_KEY` qo'shing va serverni qayta ishga tushiring.

---

## Skriptlar

| Buyruq | Vazifasi |
| --- | --- |
| `npm run dev` | Ishlab chiqish serveri |
| `npm run build` | Production build |
| `npm test` | Birlik sinovlari (baza va API kaliti kerak emas) |
| `npm run test:e2e` | Uchidan-uchgacha sinovlar (serverni o'zi ko'taradi, baza kerak) |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run lint` | ESLint |
| `npm run format` | Prettier bilan formatlash |
| `npm run ai:smoke` | AI qatlamini haqiqiy provider bilan sinash |
| `npm run ai:stats` | Generatsiya statistikasi (qayta urinish, davomiylik) |
| `npm run db:migrate` | Migratsiya yaratish va qo'llash |
| `npm run db:studio` | Prisma Studio (bazani ko'rish) |
| `npm run db:reset` | Bazani tozalab qaytadan qurish |

---

## Autentifikatsiya

### Oqim

```
/register → hisob yaratiladi → sessiya darhol beriladi → /dashboard
/login    → parol tekshiriladi → sessiya beriladi      → /dashboard
/logout   → sessiya BAZADAN o'chiriladi + cookie tozalanadi → /login
```

### Sessiya qanday ishlaydi

Ikki qatlamli: bazadagi `Session` yozuvi + uni ko'rsatuvchi imzolangan JWT
cookie'da.

Nega faqat JWT yetarli emas: imzolangan token muddati tugamaguncha yaroqli
bo'lib qoladi, ya'ni "chiqish" faqat cookie'ni o'chiradi va o'g'irlangan
token nusxasi ishlashda davom etadi. Bazada yozuv bo'lsa — uni o'chirish
bilan sessiya **darhol** kuchdan qoladi. Buni sinov ham tekshiradi
(`chiqqandan keyin ESKI cookie ham ishlamaydi`).

Cookie sozlamalari: `httpOnly` (JS tega olmaydi — XSS bo'lsa ham
o'g'irlanmaydi), `sameSite: lax` (boshqa saytdan yuborilgan so'rovda
ketmaydi — CSRF himoyasi), productionda `secure`.

### Himoya ikki darajada

| Qatlam | Nima tekshiradi | Nima uchun |
| --- | --- | --- |
| `proxy.ts` | cookie bor va imzosi to'g'rimi | Qulaylik: foydalanuvchini `/login`ga yuboradi. Bazaga tegmaydi, chunki har so'rovda (prefetch'da ham) ishlaydi |
| `requireUser()` | sessiya bazada hali mavjudmi | **Haqiqiy himoya.** API route'lar va sahifalar shundan foydalanadi |

> Next.js 16'da `middleware.ts` eskirgan va `proxy.ts` ga nomlangan.
> Vazifasi bir xil, faqat fayl va eksport nomi boshqa.

### API route'da userId olish

`userId` **hech qachon** so'rov tanasidan olinmaydi — faqat sessiyadan:

```ts
import { requireUser } from "@/lib/auth/session";

export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();        // kirmagan bo'lsa 401
  const input = await parseJsonBody(request, lessonPlanInputSchema);

  const plan = await prisma.lessonPlan.create({
    data: { ...input, userId: user.id },   // ← sessiyadan
  });
  return ok(plan, 201);
});
```

Klient yuborgan `userId` ga ishonib bo'lmaydi: uni brauzer konsolidan
o'zgartirib, boshqa foydalanuvchi nomidan yozish mumkin.

### Klientda foydalanuvchi

`useUser()` **so'rov yubormaydi** — `app/dashboard/layout.tsx` foydalanuvchini
serverda o'qib, context orqali uzatadi:

```tsx
"use client";
import { useUser } from "@/lib/hooks/use-user";

export function Greeting() {
  const user = useUser();           // { id, email, fullName, role, language }
  return <p>Salom, {user.fullName}</p>;
}
```

Bu hook faqat **ko'rsatish** uchun (ism, til, "chiqish" tugmasi). Ma'lumot
yozishda `user.id` ni API'ga yubormang — yuqoridagi `requireUser()` ga qara.

### MVP doirasidan tashqarida

Ataylab kiritilmagan: parolni tiklash, email tasdiqlash, OAuth,
rol-based ruxsatlar tizimi, CSRF tokeni (`sameSite: lax` MVP uchun yetarli),
kirishga urinishlar chekloviga (rate limit).

---

## AI qatlami

Butun ilova AI bilan **faqat** `lib/ai/provider.ts` orqali gaplashadi.
Modullar qaysi provider ishlatilayotganini bilmaydi.

```ts
import { generateText, generateJson } from "@/lib/ai/provider";

// Oddiy matn
const result = await generateText({
  prompt: "Fotosintez nima?",
  systemPrompt: "Sen o'qituvchiga yordam beradigan yordamchisan.",
});

// Struktura qilingan JSON — zod sxemasi bilan kafolatlangan
const { data } = await generateJson({
  schema: z.object({ title: z.string(), steps: z.array(z.string()) }),
  prompt: "Dars rejasini tuz",
});
```

### Provider almashtirish

`.env` dagi bir-ikki qatorni o'zgartirish yetarli — kod tegilmaydi:

| Xizmat | `AI_PROVIDER` | `AI_BASE_URL` |
| --- | --- | --- |
| OpenAI | `openai` | (bo'sh) |
| OpenRouter | `openai` | `https://openrouter.ai/api/v1` |
| Gemini | `openai` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Groq | `openai` | `https://api.groq.com/openai/v1` |
| Ollama (mahalliy) | `openai` | `http://localhost:11434/v1` |
| Anthropic | `anthropic` | (bo'sh) |

### Xatoliklarni qayta ishlash

`generateText` faqat `AiError` tashlaydi. Unda ikki xil xabar bor:

- `error.message` — texnik tafsilot, **faqat log uchun**
- `error.userMessage` — foydalanuvchiga ko'rsatish uchun xavfsiz xabar

Turlari: `not_configured`, `auth`, `rate_limit`, `quota`, `timeout`,
`network`, `bad_request`, `server`, `bad_response`, `aborted`, `unknown`.
Vaqtinchalik xatolar (`rate_limit`, `timeout`, `network`, `server`) avtomatik
qayta urinadi — eksponensial kutish va `Retry-After` hurmati bilan.

---

## Dars ishlanmasi moduli

### Oqim

```
Forma → POST /api/lesson-plans
  → LessonPlan yozuvi (status: PENDING)
  → AI (generateJson + zod sxema)
  → READY: content to'ldiriladi, aiDurationMs saqlanadi
  → FAILED: errorMessage saqlanadi, «Qayta urinish» tugmasi paydo bo'ladi
```

Generatsiya MVP'da **sinxron** — route AI javobini kutadi (5–40 soniya).
Fon rejimi keyingi bosqichda; yozuv `PENDING` bilan oldin yaratilgani uchun
oqim o'zgarmaydi.

### Nega yozuv AI'dan OLDIN yaratiladi

1. AI yiqilsa foydalanuvchi ro'yxatda `FAILED` yozuvni ko'radi va bir tugma
   bilan qayta urinadi — kiritgan ma'lumoti yo'qolmaydi.
2. `aiDurationMs` saqlanadi — Step 5 (performance) uchun o'lchov.
3. Fon rejimiga o'tishda kod tuzilishi o'zgarmaydi.

### Sxemalar

`lib/validations/lesson-plan.ts` da **ikki xil** sxema bor, ularni
aralashtirmaslik kerak:

| Sxema | Nima uchun |
| --- | --- |
| `lessonPlanInputSchema` | Foydalanuvchi formasidan keladigan ma'lumot |
| `lessonPlanContentSchema` | AI qaytaradigan struktura + bazadagi `content` ni qayta o'qish |
| `lessonPlanContentSchemaFor(dur)` | Yuqoridagi + bosqichlar vaqti yig'indisi tekshiruvi |

`content` — Json ustun, ya'ni TypeScript uchun `unknown`. Uni `as` bilan
tiplashtirish xavfli (eski yozuvlar boshqa shaklda bo'lishi mumkin), shuning
uchun **har doim** `parseLessonPlanContent()` orqali o'qiladi — mos kelmasa
`null` qaytadi va sahifa qulamaydi.

### Vaqt yig'indisi

Promptda bosqichlar yig'indisi dars davomiyligiga teng bo'lishi aniq son
bilan talab qilinadi. Sxema esa **keng chegara** (50%–150%) qo'yadi:

- qat'iy tenglik talab qilsak, 45 o'rniga 44 qaytganda butun generatsiya
  yiqilardi — foydalanuvchi uchun bu "AI ishlamadi", holbuki natija yaroqli;
- keng chegara mantiqsiz javoblarni (45 daqiqalik darsga 9 daqiqa) tutadi va
  `generateJson` modelga xatoni aytib qayta so'raydi.

Aniq yig'indi natija sahifasida ko'rsatiladi — mos kelmasa o'qituvchi ko'radi.

### Ko'p tillilik

Promptlar **to'liq** tarjima qilingan (`lib/lesson-plans/prompt.ts`), "javobni
rus tilida ber" degan qo'shimcha emas. Sabab: model bunday ko'rsatmani
ko'pincha qisman bajaradi — sarlavhalarni tarjima qilib, matnni prompt tilida
qoldiradi.

JSON **maydon nomlari** hamma tilda inglizcha qoladi — ular zod sxemasining
kalitlari. Buni sinov tekshiradi.

### Routelar

| Route | Vazifasi |
| --- | --- |
| `POST /api/lesson-plans` | Yangi generatsiya |
| `GET /api/lesson-plans` | Ro'yxat (`?status=`, `?limit=`, `?cursor=`) |
| `GET /api/lesson-plans/[id]` | Bitta ishlanma |
| `DELETE /api/lesson-plans/[id]` | O'chirish |
| `POST /api/lesson-plans/[id]/regenerate` | Qayta generatsiya (o'rnida) |

Egalik har bir so'rovda `where: { id, userId }` bilan tekshiriladi. Begona
yozuv uchun **404** qaytadi, 403 emas — 403 "bu yozuv bor, lekin sizga
tegishli emas" degan ma'noni berib, boshqa foydalanuvchilarning yozuvlari
borligini oshkor qilardi.

---

## Prezentatsiya moduli (.pptx)

### Ikki kirish nuqtasi

```
A) Dars ishlanmasidan (ASOSIY oqim)
   { "mode": "from-lesson-plan", "lessonPlanId": "..." }
   → mavzu, fan, sinf va TIL yozuvning o'zidan olinadi
   → promptga dars maqsadi, natijalari va BOSQICHLARI kiritiladi
   → har bir dars bosqichiga taxminan bitta slayd to'g'ri keladi

B) Mustaqil
   { "mode": "standalone", "topic": "...", "subject": "...", "grade": "..." }
```

Sxema `z.discriminatedUnion("mode", ...)` — oddiy `.optional()` maydonlar
bilan qilinsa, "lessonPlanId ham, topic ham berilgan" yoki "ikkisi ham yo'q"
kabi mantiqsiz holatlar o'tib ketardi.

### Qatlamlar

| Qatlam | Javobgarligi |
| --- | --- |
| `lib/pptx/generate.ts` | Slaydlar JSON → .pptx Buffer. **AI, baza va sessiyadan MUSTAQIL** |
| `lib/pptx/theme.ts` | Rang, shrift, o'lchamlar — dizayn shu yerda |
| `lib/presentations/prompt.ts` | UZ/RU/EN promptlari + dars ishlanmasi konteksti |
| `lib/presentations/storage.ts` | Fayl saqlash/o'qish/o'chirish |
| `lib/presentations/service.ts` | Oqim: PENDING → AI → .pptx → READY/FAILED |

`generate.ts` ning mustaqilligi ataylab: uni sinovda hech narsa mock
qilmasdan chaqirish mumkin, va fayl formatini o'zgartirganda AI qatlamiga
tegish kerak emas.

### Fayllar qayerda saqlanadi

Ikki drayver, `.env` dagi `STORAGE_DRIVER` orqali tanlanadi — batafsil
[Fayl saqlagichi](#fayl-saqlagichi) bo'limida.

Ikkalasida ham fayl **`public/` da saqlanmaydi**: u yerdagi hamma narsani
Next.js statik tarqatadi, ya'ni havolani bilgan har qanday odam faylni
olardi va yuklab olish route'idagi egalik tekshiruvi bekor bo'lardi.

### Yuklab olish

```
content-type: application/vnd.openxmlformats-officedocument.presentationml.presentation
content-disposition: attachment; filename="..."; filename*=UTF-8''...
cache-control: private, no-store
```

`filename` va `filename*` ikkalasi ham beriladi: `oʻ`, `gʻ` va kirill
harflari ASCII `filename` da ishlamaydi, `filename*` esa eski mijozlarda
qo'llab-quvvatlanmaydi.

### Routelar

| Route | Vazifasi |
| --- | --- |
| `POST /api/presentations` | Generatsiya (ikki rejim) |
| `GET /api/presentations` | Ro'yxat |
| `GET /api/presentations/[id]` | Bitta yozuv |
| `GET /api/presentations/[id]/download` | .pptx yuklab olish |
| `DELETE /api/presentations/[id]` | O'chirish (yozuv + fayl) |
| `POST /api/presentations/[id]/regenerate` | Qayta generatsiya |

### Ma'lum cheklov

Foydalanuvchi o'chirilsa prezentatsiya va kalendar reja yozuvlari cascade
bilan o'chadi, lekin **saqlagichdagi fayllar qoladi** — baza cascade'i
fayl tizimini ham, S3 ni ham bilmaydi. To'liq ro'yxat pastdagi
«Ma'lum cheklovlar» bo'limida.

---

## Kalendar-tematik reja moduli (.xlsx)

### Oqim

```
Forma → POST /api/calendar-plans
  → CalendarPlan yozuvi (PENDING)
  → hafta sanalari KODDA hisoblanadi va promptga qo'shiladi
  → AI mavzularni haftalarga taqsimlaydi
  → exceljs jadvalni yasaydi
  → READY: filePath, rowCount, aiDurationMs
```

### Sanalarni AI hisoblamaydi

Hafta oraliqlari `lib/calendar-plans/dates.ts` da hisoblanib, promptga
**tayyor** holda beriladi; AI ularni faqat ko'chiradi.

Sabab: modellar sana arifmetikasida ishonchsiz — 30 kunli oyni 31 deb,
kabisa yilini unutib yuboradi. Oy, yil va kabisa chegaralari sinov bilan
qoplangan.

### Token chegarasi

Bu modul boshqalardan uzunroq javob qaytaradi: bir o'quv yili ≈ 100 qator.
Shuning uchun `estimateMaxTokens(weeks)` chegarani hafta soniga qarab
hisoblaydi (`weeks × 400 + 2000`, `AI_MAX_TOKENS` dan past emas, 32000 dan
yuqori emas). Standart 16000 bilan 52 haftalik reja javobi o'rtada kesilib,
JSON buzilishi mumkin edi.

### Excel formatlash

`lib/xlsx/theme.ts` — rang, shrift, ustun kengliklari bir joyda.

- Sarlavha qatori: qalin, to'q fon, oq matn
- Barcha katakchalarda chegara
- Sarlavha qatorlari **qotirilgan** (`ySplit: 2`) — 70 qatorli jadvalda
  pastga tushganda ustun nomlari ko'rinib turadi
- Bitta haftada bir nechta mavzu bo'lsa, hafta raqami va sanasi
  birlashtiriladi
- Oxirida "Jami" qatori

> **ExcelJS tuzog'i:** ustun kengligi aynan `9` bo'lsa, ExcelJS uni o'zining
> standart qiymati deb biladi va faylga **umuman yozmaydi**. Niyat jim
> yo'qoladi. Shuning uchun hafta ustuni `10`, va sinov har bir ustun
> kengligini alohida tekshiradi.

### Sekinlik — ataylab sinxron

Bu eng sekin modul (40-60 soniya). MVP'da sinxron qoldirilgan; fon rejimi
Step 5 da. Forma kutish vaqtini **oldindan** ogohlantiradi, o'tgan soniyalarni
ko'rsatadi va 45 soniyadan keyin qo'shimcha tinchlantiruvchi xabar beradi —
foydalanuvchi sahifani yopib, generatsiyani bekorga ketkazmasligi uchun.

### Routelar

| Route | Vazifasi |
| --- | --- |
| `POST /api/calendar-plans` | Generatsiya |
| `GET /api/calendar-plans` | Ro'yxat |
| `GET /api/calendar-plans/[id]` | Bitta yozuv |
| `GET /api/calendar-plans/[id]/download` | .xlsx yuklab olish |
| `DELETE /api/calendar-plans/[id]` | O'chirish (yozuv + fayl) |
| `POST /api/calendar-plans/[id]/regenerate` | Qayta generatsiya |

---

## Ko'p tillilik (i18n)

Interfeys **ikki tilli**: o'zbek (standart) va rus. Kutubxona — `next-intl`.

### Interfeys tili ≠ generatsiya tili

Bu ikkisi **butunlay alohida** tushuncha:

| | Interfeys tili | Generatsiya tili |
| --- | --- | --- |
| Nima | Tugmalar, sarlavhalar, xatolar | Dars ishlanmasi/slayd/jadval MATNI |
| Qayerda | `User.language`, cookie | Har generatsiya formasida tanlanadi |
| Tillar | uz, ru | UZ, RU, EN |

O'qituvchi interfeysni ruscha ishlatib, dars ishlanmasini o'zbekcha
so'rashi mumkin — bu qo'llab-quvvatlanadi va sinov bilan tekshiriladi.

### URL'da til prefiksi yo'q

next-intl'ning odatiy sozlamasi `/[locale]/...` segmentidan foydalanadi.
Bizda til manbai boshqa, shuning uchun u ishlatilmadi: URL'ga til
qo'shilsa, bir xil sahifaning ikki manzili paydo bo'lardi va `proxy.ts`
hamda barcha havolalarni qayta yozishga to'g'ri kelardi.

Til har so'rovda `lib/i18n/locale.ts` da aniqlanadi:

```
1. User.language      — kirgan foydalanuvchi ataylab tanlagan
2. Cookie             — kirmagan foydalanuvchi tanlovi
3. Accept-Language    — brauzer tili
4. "uz"               — standart
```

Foydalanuvchi cookie'dan **ustun** turadi: u boshqa qurilmadan kirsa ham
o'z tilini ko'rishi kerak.

### Xato xabarlari — kalit, matn emas

Xato tashlanadigan joy (servis qatlami, zod sxemasi) foydalanuvchi tilini
bilmaydi va bilishi shart emas. Shuning uchun ular **tarjima kaliti**
qaytaradi:

```ts
throw apiErrors.notFound("errors.domain.lessonPlanNotFound");
// zod: .min(3, "errors.validation.topicTooShort")
```

Tarjima javob shakllanadigan joyda — `withErrorHandling` da — qilinadi,
chunki aynan o'sha yerda so'rov tili ma'lum. Javobda ikkalasi ham bo'ladi:

```json
{ "ok": false, "error": {
  "code": "not_found",
  "message": "План урока не найден.",
  "messageKey": "errors.domain.lessonPlanNotFound",
  "fieldErrors": { "topic": ["Тема должна содержать не менее 3 символов"] }
}}
```

> **Istisno:** AI **kontent** sxemalarining xabarlari tabiiy matn bo'lib
> qoladi (`lessonPlanContentSchemaFor` va h.k.). Ular foydalanuvchiga
> ko'rsatilmaydi — `generateJson` ularni MODELGA qayta so'rov bilan
> yuboradi, model esa kalitni emas, tushunarli matnni o'qiydi.

### `errorMessage` ustunida ham kalit

`status = FAILED` bo'lganda bazaga kalit yoziladi. Sabab: yozuv bir marta
yaratiladi, lekin ko'p marta ko'riladi — foydalanuvchi orada tilni
o'zgartirishi mumkin.

i18n'gacha yaratilgan yozuvlarda tayyor matn turibdi, shuning uchun
`translateStoredError()` qiymat kalitga o'xshasa tarjima qiladi, aks
holda borligicha ko'rsatadi.

### Til almashtirgich

Dashboard sarlavhasida va kirish/ro'yxat sahifalarida. `PUT
/api/user/language` kirgan foydalanuvchi uchun `User.language` ga, hamma
uchun cookie'ga yozadi.

### Tarjima fayllari

`messages/uz.json` va `messages/ru.json` — **264 kalit**, ikkalasida bir
xil. Buni sinov avtomatik tekshiradi (`tests/i18n-messages.test.ts`):
yetishmagan/ortiqcha kalitlar, bo'sh qiymatlar, TODO qoldiqlari va hatto
`{parametr}` o'rinbosarlarining mosligi.

---

## Fayl saqlagichi

Generatsiya qilingan `.pptx` va `.xlsx` fayllar ikki xil joyda saqlanishi
mumkin. Yuqori qatlam (prezentatsiya, kalendar reja) qaysi drayver
ishlayotganini **bilmaydi** — u faqat `saveFile()`, `getFile()`,
`deleteFile()` ni chaqiradi.

| Drayver | Qayerda | Qachon |
| --- | --- | --- |
| `local` | `storage/` papka | VPS, Docker, mahalliy ishlab chiqish |
| `s3` | S3-mos xizmat | Vercel va boshqa serverless muhitlar |

### local (standart)

```bash
STORAGE_DRIVER="local"
```

Boshqa sozlama kerak emas. Fayllar `storage/presentations/` va
`storage/calendar-plans/` papkalariga yoziladi (git'ga tushmaydi).

> **Serverless'da ISHLAMAYDI.** Vercel kabi muhitlarda fayl tizimi faqat
> o'qish uchun ochiq. U yerda `s3` majburiy.

### s3 (Cloudflare R2 / AWS S3 / MinIO)

Uchala xizmat ham bir xil S3 API'siga ega — farq faqat `S3_ENDPOINT` da.

```bash
STORAGE_DRIVER="s3"
S3_BUCKET="searcher-ai"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
```

| Xizmat | `S3_ENDPOINT` | `S3_REGION` |
| --- | --- | --- |
| Cloudflare R2 | `https://<account-id>.r2.cloudflarestorage.com` | `auto` |
| AWS S3 | (bo'sh qoldiring) | `us-east-1` kabi |
| MinIO | `http://localhost:9000` | `auto` |

`STORAGE_DRIVER="s3"` tanlangan, lekin `S3_BUCKET`/`S3_ACCESS_KEY`/
`S3_SECRET_KEY` to'ldirilmagan bo'lsa, ilova **ishga tushishda** xato
beradi — generatsiya tugagandan keyin emas.

### Drayver almashtirish

Bazadagi `filePath` ustuniga **faqat fayl nomi** yoziladi (`abc123.pptx`),
papka esa drayver tomonidan qo'shiladi. Shu tufayli drayverni almashtirish
bazani o'zgartirishni talab qilmaydi — lekin **eski fayllar ko'chirilmaydi**,
ularni qo'lda ko'chirish kerak.

Joriy drayverni tekshirish:

```bash
curl -s localhost:3000/api/health | grep -o '"driver":"[a-z0-9]*"'
```

---

## Fon generatsiyasi (performance)

### Oldin / keyin

| | Oldin | Keyin |
| --- | --- | --- |
| POST javobi | 10–60 soniya kutish | **~0.2 soniya**, `202 Accepted` |
| Foydalanuvchi | Formada qotib turadi | Natija sahifasida, jarayon ko'rinadi |
| Sahifani yopsa | Ish bekor ketadi | Generatsiya davom etadi |
| Brauzer | "Javob bermayapti" chiqishi mumkin | Muammo yo'q |

### Qanday ishlaydi

```
POST /api/{resource}
  → PENDING yozuv yaratiladi
  → 202 + { id, status: "PENDING" } DARHOL qaytadi
  → after(): generatsiya javobdan KEYIN davom etadi
Frontend
  → natija sahifasiga o'tadi (URL darhol almashadi)
  → GenerationProgress har 2 soniyada holatni so'raydi
  → READY/FAILED bo'lgach router.refresh()
```

### Nega `after()`, navbat emas

Uch variant ko'rildi:

| Variant | Xulosa |
| --- | --- |
| **`after()`** (Next.js primitivi) | **Tanlandi** — qo'shimcha xizmat yo'q, javob yuborilgach ishlaydi |
| `void doWork()` | Next.js javob tugagach ishni to'xtatishi mumkin |
| Redis + BullMQ | To'g'ri, lekin yangi xizmat + deploy + nosozlik nuqtasi. MVP muddatiga arzimaydi |

Bazadagi `status` ustuni allaqachon navbat vazifasini bajaradi
(PENDING → READY/FAILED).

> **`maxDuration` tuzog'i:** route'larda qiymat **literal** yozilgan
> (`export const maxDuration = 300`). Next.js segment sozlamalarini build
> paytida statik o'qiydi va import qilingan konstantani hisoblay olmaydi —
> "Invalid segment configuration export" xatosi chiqadi.

### Osilib qolgan yozuvlar

Fon ishi tugamay qolishi mumkin (server qayta ishga tushdi, `maxDuration`
tugadi). Bunda yozuv mangu PENDING qolardi.

`markStaleAsFailed()` 5 daqiqadan uzoq PENDING turgan yozuvlarni FAILED
qiladi. Tekshiruv ro'yxat/detal **o'qish yo'lida** bajariladi — alohida
cron kerak emas. Polling hook'ning chegarasi (6 daqiqa) bundan **uzunroq**,
shunda foydalanuvchi sababni ko'radi; buni sinov ham tekshiradi.

### Qayta urinish tannarxi

`npm run ai:stats` — `aiAttempts` va `aiDurationMs` ustunlaridan
statistika: qayta urinish ulushi, o'rtacha/p50/p95 davomiylik. Ulush 20%
dan oshsa, skript prompt yaxshilash bo'yicha aniq tavsiya beradi.

`generateJson` endi `schemaAttempts` va `totalDurationMs` qaytaradi —
ilgari `durationMs` faqat OXIRGI chaqiruvni o'lchardi va qayta urinish
bo'lganda haqiqiy kutish vaqtidan kam ko'rsatardi.

### O'lchangan natijalar

| Tekshiruv | Natija |
| --- | --- |
| POST javob vaqti (kalendar reja) | 223 ms |
| Klient bundle (barcha chunk'lar) | 768 KB |
| `pptxgenjs` / `exceljs` klientda | yo'q ✓ |
| SQL so'rovlar `/dashboard` uchun | ~1.4 (ya'ni `cache()` ishlayapti) |

### Sahifalash

Ro'yxat sahifalari **20 ta** yozuv bilan ochiladi (ilgari 50), qolgani
"Ko'proq yuklash" tugmasi bilan. Birinchi sahifa SERVERDA render
qilinadi — qo'shimcha HTTP so'rovsiz.

---

## API route yozish

Har bir modulda `try/catch` takrorlanmaydi — umumiy wrapper bor:

```ts
// app/api/lesson-plans/route.ts
import { withErrorHandling, parseJsonBody, ok } from "@/lib/api/with-error-handling";
import { lessonPlanInputSchema } from "@/lib/validations";

export const POST = withErrorHandling(async (request) => {
  const input = await parseJsonBody(request, lessonPlanInputSchema);
  const plan = await createLessonPlan(input);
  return ok(plan, 201);
});
```

Javoblar har doim bir xil shaklda:

```ts
{ ok: true,  data: { ... } }
{ ok: false, error: { code, message, fieldErrors? } }
```

---

## Loyiha tuzilishi

```
app/
  api/health/route.ts        sog'lik tekshiruvi
  api/auth/{register,login,logout,me}/route.ts
  api/lesson-plans/...        dars ishlanmasi API'si
  api/presentations/...       prezentatsiya API'si + /download
  api/calendar-plans/...      kalendar reja API'si + /download
  login/ register/ dashboard/
  dashboard/lesson-plans/     ro'yxat, /new forma, /[id] natija
  dashboard/presentations/    ro'yxat, /new forma, /[id] natija
  dashboard/calendar-plans/   ro'yxat, /new forma, /[id] jadval
proxy.ts                     himoyalangan sahifalar (Next 16: middleware o'rniga)
components/
  auth-form.tsx              login/register uchun umumiy forma
  logout-button.tsx  user-greeting.tsx
lib/
  env.ts                     muhit o'zgaruvchilari — YAGONA o'qish joyi
  db.ts                      Prisma klient singleton
  api-client.ts              brauzerdan API chaqirish
  auth/
    jwt.ts                   JWT imzo/tekshiruv (proxy ham ishlatadi)
    session.ts               sessiya, parol hash, requireUser()
  hooks/use-user.tsx         UserProvider + useUser()
  pptx/
    generate.ts              slaydlar JSON → .pptx Buffer (AI'dan mustaqil)
    theme.ts                 rang va o'lcham sxemasi
  xlsx/
    generate.ts              reja JSON → .xlsx Buffer (AI'dan mustaqil)
    theme.ts                 rang, ustun kengliklari, chegaralar
  storage/files.ts           umumiy fayl saqlagichi (pptx + xlsx)
  calendar-plans/
    service.ts               generatsiya oqimi + token hisobi
    prompt.ts                UZ/RU/EN + tayyor hafta sanalari
    dates.ts                 hafta oraliqlarini hisoblash
  presentations/
    service.ts               generatsiya oqimi
    prompt.ts                UZ/RU/EN + dars ishlanmasi konteksti
    storage.ts               fayl saqlagichi (public'dan tashqarida)
  ui/labels.ts               sana/hajm formatlash (tilga qarab)
  ui/options.ts              forma tanlovlari (kalitlar)
  i18n/
    config.ts                tillar, cookie nomi, Accept-Language tahlili
    locale.ts                so'rov tilini aniqlash (server)
    translate.ts             xato kalitlarini tarjima qilish
    stored-error.ts          bazadagi eski matnlarni qo'llab-quvvatlash
  lesson-plans/
    service.ts               generatsiya, ro'yxat, egalik tekshiruvi
    prompt.ts                UZ/RU/EN promptlari
    labels.ts                UI yorliqlari (keyinchalik i18n ga ko'chadi)
  ai/
    provider.ts              AI qatlamining kirish nuqtasi
    types.ts                 umumiy tiplar va AiError
    json.ts                  javobdan JSON ajratish
    transports/
      http.ts                umumiy HTTP + xatolik tarjimasi
      openai-compatible.ts   /chat/completions
      anthropic.ts           /v1/messages
  api/
    errors.ts                ApiError
    with-error-handling.ts   route wrapper
  validations/
    common.ts                umumiy zod bo'laklari
    auth.ts                  register/login sxemalari
    lesson-plan.ts           kirish + AI kontent sxemalari
    presentation.ts          ikki rejim + slaydlar sxemasi
    calendar-plan.ts         kirish + haftalar/soatlar sxemasi
i18n/request.ts              next-intl so'rov sozlamasi
messages/                    uz.json, ru.json (264 kalit)
prisma/
  schema.prisma              DB sxemasi
  migrations/                migratsiyalar
storage/                     generatsiya qilingan .pptx va .xlsx (git'ga tushmaydi)
tests/                       birlik sinovlari (mock AI server bilan)
  e2e/                       uchidan-uchgacha (haqiqiy server + baza)
```

---

## Muhit o'zgaruvchilari

| O'zgaruvchi | Majburiymi | Standart | Tavsif |
| --- | --- | --- | --- |
| `DATABASE_URL` | **ha** | — | PostgreSQL ulanish manzili |
| `AUTH_SECRET` | **ha** | — | Sessiya JWT kaliti, ≥32 belgi. `openssl rand -base64 48` |
| `APP_URL` | yo'q | `http://localhost:3000` | Ilova manzili |
| `AI_PROVIDER` | yo'q | `openai` | `openai` yoki `anthropic` |
| `AI_API_KEY` | yo'q\* | — | Bo'sh bo'lsa AI funksiyalari o'chadi, ilova ishlaydi |
| `AI_MODEL` | yo'q | provider bo'yicha | `gpt-4o-mini` / `claude-opus-5` |
| `AI_BASE_URL` | yo'q | provider bo'yicha | OpenRouter, Gemini, Groq, Ollama uchun |
| `AI_TIMEOUT_MS` | yo'q | `90000` | Bitta AI so'rovining chegarasi |
| `AI_MAX_RETRIES` | yo'q | `2` | Vaqtinchalik xatolarda qayta urinish |
| `AI_MAX_TOKENS` | yo'q | `16000` | Javobdagi maksimal token (kalendar reja o'zi oshiradi) |
| `STORAGE_DRIVER` | yo'q | `local` | `local` yoki `s3` |
| `S3_BUCKET` | s3 uchun **ha** | — | Bucket nomi |
| `S3_ENDPOINT` | yo'q | — | R2/MinIO uchun; AWS S3 da bo'sh |
| `S3_ACCESS_KEY` | s3 uchun **ha** | — | |
| `S3_SECRET_KEY` | s3 uchun **ha** | — | |
| `S3_REGION` | yo'q | `auto` | AWS S3 da haqiqiy region |
| `PRISMA_LOG_QUERIES` | yo'q | — | `1` — har bir SQL so'rovni loglaydi |

\* `AI_API_KEY` bo'lmasa ilova ishga tushadi va sahifalar ochiladi, lekin
har qanday generatsiya «AI xizmati sozlanmagan» xatosi bilan tugaydi.

---

## Deploy

### Muhit tanlash — eng muhim qaror

Generatsiya `after()` orqali javob yuborilgandan **keyin** davom etadi,
ya'ni u platformaning funksiya davomiyligi chegarasiga bo'ysunadi.
Route'larda `maxDuration = 300` (5 daqiqa) so'ralgan.

| Muhit | Davomiylik chegarasi | Saqlagich | Xulosa |
| --- | --- | --- | --- |
| **VPS / Docker** | **chegara yo'q** | `local` ishlaydi | ✅ Tavsiya etiladi |
| Vercel Pro | 300s gacha sozlanadi | `s3` majburiy | ✅ Ishlaydi |
| Vercel Hobby (bepul) | ~60s | `s3` majburiy | ⚠️ **Xavfli** |

> **Vercel bepul tarifi haqida ogohlantirish**
>
> Bepul tarifda funksiya davomiyligi ~60 soniya bilan chegaralangan.
> Dars ishlanmasi va prezentatsiya odatda shu chegaraga sig'adi, lekin
> **kalendar reja** (34+ haftalik davr, uzun javob, qayta urinish
> ehtimoli bilan) chegaraga yaqin yoki undan oshib ketishi mumkin.
>
> Chegara oshsa generatsiya o'rtada uziladi va yozuv `PENDING` holatida
> qoladi — `markStaleAsFailed()` uni 5 daqiqadan keyin `FAILED` qiladi,
> foydalanuvchi «qayta urinish» tugmasini ko'radi. Ya'ni ilova qulamaydi,
> lekin uzun kalendar rejalar **ishonchsiz** bo'ladi.
>
> Aniq chegaralar o'zgarib turadi — deploy'dan oldin Vercel hujjatlarini
> tekshiring.
>
> **Tavsiya:** MVP topshirish uchun VPS (yoki Docker) ishonchliroq —
> davomiylik chegarasi yo'q va `local` saqlagich qo'shimcha xizmatsiz
> ishlaydi.

### VPS / Docker

```bash
docker compose up -d          # PostgreSQL
npm ci
npm run db:deploy             # migratsiyalar
npm run build
npm start
```

`.env`: `STORAGE_DRIVER="local"` (standart). `storage/` papkasi yozish
uchun ochiq bo'lishi kerak.

### Vercel

1. `STORAGE_DRIVER="s3"` va S3 sozlamalarini Environment Variables'ga
   qo'shing (`local` u yerda **ishlamaydi**)
2. Boshqariladigan PostgreSQL ulang (Neon, Supabase kabi)
3. Pro tarifda ekaningizni tasdiqlang — yuqoridagi ogohlantirishga qarang

### Deploy'dan keyin tekshirish

```bash
curl -s https://<domen>/api/health | python3 -m json.tool
```

`database.connected: true`, `ai.configured: true` va kutilgan
`storage.driver` bo'lishi kerak.

---

## Ma'lum cheklovlar

MVP doirasida **ataylab** qoldirilgan narsalar. Har biri ma'lum va
hujjatlashtirilgan — kutilmagan nosozlik emas.

| Cheklov | Ta'siri | Nima qilish kerak |
| --- | --- | --- |
| Hisob o'chirilganda fayllar qoladi | Saqlagichda yetim fayllar to'planadi | Hisobni o'chirish funksiyasi qo'shilganda avval fayllarni o'chirish |
| CSRF tokeni yo'q | `sameSite: lax` cookie'ga tayanadi | Double-submit token qo'shish |
| Kirishga urinishlar cheklanmagan | Brute-force faqat bcrypt sekinligiga tayanadi | IP/email bo'yicha rate limit |
| Parolni tiklash yo'q | Parol unutilsa hisob yo'qoladi | Email orqali tiklash oqimi |
| Email tasdiqlash yo'q | Soxta email bilan ro'yxatdan o'tish mumkin | Tasdiqlash havolasi |
| Interfeys faqat UZ/RU | Inglizcha interfeys yo'q (generatsiya EN'da ishlaydi) | `messages/en.json` qo'shish |
| Drayver almashtirilganda fayllar ko'chmaydi | `local` → `s3` da eski fayllar topilmaydi | Qo'lda ko'chirish |
| `markStaleAsFailed` o'qish yo'lida | Har ro'yxat/detal o'qishda bitta `updateMany` | Yuklama oshsa cron'ga o'tkazish |
| AI qidiruv (Searcher) moduli yo'q | TZ'dagi 5-funksiya | Alohida modul |
| `.docx` / `.pdf` eksport yo'q | Faqat `.pptx` va `.xlsx` | TZ'da 19-sentabr uchun rejalashtirilgan edi |

---

## Modullar holati

| Modul | Holat |
| --- | --- |
| Skelet, DB, AI qatlami | ✅ tayyor |
| Autentifikatsiya | ✅ tayyor |
| Dars ishlanmasi generatsiyasi | ✅ tayyor |
| Prezentatsiya (.pptx) | ✅ tayyor |
| Excel reja (.xlsx) | ✅ tayyor |
| .docx / .pdf eksport | ⬜ |
| Ko'p tillilik (interfeys UZ/RU) | ✅ tayyor |
| AI qidiruv (Searcher) | ⬜ |
