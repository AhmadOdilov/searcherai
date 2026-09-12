# Searcher AI — demo senariysi

**Umumiy vaqt: ~2 daqiqa.** To'rt bosqich, har biri mustaqil ishlaydi —
bittasi yiqilsa, keyingisiga o'tish mumkin.

---

## Tayyorgarlik (taqdimotdan OLDIN)

Bu qadamlar sahnada bajarilmaydi — oldindan tekshirib qo'yiladi.

```bash
# 1. Baza va ilova ishlayotganini tasdiqlash
curl -s localhost:3000/api/health | python3 -m json.tool
```

Kutilgan javob:

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "database": { "connected": true },
    "ai": { "configured": true },
    "storage": { "driver": "local" }
  }
}
```

> `ai.configured` **`false`** bo'lsa — demo ishlamaydi. `.env` dagi
> `AI_API_KEY` ni tekshiring.

**Brauzer tayyorgarligi:**

- Ikkita oyna oching: birinchisi demo uchun, ikkinchisida `/api/health`
- Zoom darajasini 125–150% ga qo'ying — proyektorda matn o'qilsin
- Yangi (bo'sh) hisob bilan boshlang, shunda ro'yxat bo'sh ko'rinadi

**Zaxira reja:** internet yoki AI yiqilsa, oldindan yaratilgan hisobdan
tayyor natijalarni ko'rsating. Buning uchun demo oldidan bitta dars
ishlanmasi, prezentatsiya va kalendar reja yaratib qo'ying.

---

## 1-bosqich · Ro'yxatdan o'tish va bosh sahifa (~20 soniya)

**Nima qilinadi**

1. `/register` sahifasini oching
2. Ism, email va parol kiriting → **Ro'yxatdan o'tish**
3. Ishchi sahifa (dashboard) ochiladi

**Nima aytiladi**

> «O'qituvchi bir daqiqada ro'yxatdan o'tadi. Boshqa hech narsa sozlash
> kerak emas — to'rtta modul darhol ishlaydi.»

**Nimaga e'tibor qaratiladi**

- To'rtta modul kartochkasi
- Yuqori o'ng burchakdagi til almashtirgich (4-bosqichda kerak bo'ladi)

---

## 2-bosqich · Dars ishlanmasi (~40 soniya)

**Bu demoning YURAGI** — qolgan hamma narsa shundan kelib chiqadi.

**Nima qilinadi**

1. **Dars ishlanmasi** → **Yangi yaratish**
2. To'ldiring:
   - Fan: `Biologiya`
   - Sinf: `7-sinf`
   - Mavzu: `Fotosintez jarayoni`
   - Davomiylik: `45 daqiqa`
   - Dars turi: `Yangi mavzu`
3. **Dars ishlanmasini yaratish**

**Nima aytiladi (kutish paytida)**

> «Diqqat qiling — tugma bosilishi bilan sahifa darhol almashdi.
> Foydalanuvchi kutib o'tirmaydi: generatsiya serverda davom etyapti,
> sahifa esa jarayonni ko'rsatib turibdi. Sahifani yopib, keyin qaytib
> kelsa ham ish yo'qolmaydi.»

**Natija tayyor bo'lgach ko'rsatiladi**

- **Dars maqsadi** — aniq va o'lchanadigan
- **Dars bosqichlari** — har birida vaqt, o'qituvchi va o'quvchi faoliyati
  alohida
- Pastdagi **«Jami 45 daqiqa»** — vaqt taqsimoti to'g'ri chiqqani

> «Bu shunchaki matn emas — tayyor, ishlatsa bo'ladigan ishlanma.»

---

## 3-bosqich · Prezentatsiya va yuklab olish (~40 soniya)

**Nima qilinadi**

1. O'sha sahifada — **«Shundan prezentatsiya yaratish»**
2. Forma allaqachon to'ldirilgan holda ochiladi → **Prezentatsiya yaratish**
3. Tayyor bo'lgach — slaydlar ro'yxatini ko'rsating
4. **Yuklab olish** → fayl yuklanadi
5. **Faylni PowerPoint yoki LibreOffice'da oching**

**Nima aytiladi**

> «Slaydlar dars bosqichlariga mos tuzildi — har bosqichga taxminan
> bitta slayd. O'qituvchi darsni shu ketma-ketlik bo'yicha olib boradi.»

Faylni ochganda:

> «Bu haqiqiy .pptx fayl — tahrirlash mumkin. So'zlovchi izohlari ham
> o'z joyida.»

**Eng kuchli nuqta:** faylni haqiqatan ochib ko'rsatish. Ekranda
ko'rinadigan natija — eng ishonarli dalil.

---

## 4-bosqich · Ko'p tillilik (~20 soniya)

**Nima qilinadi**

1. Yuqori o'ng burchakda **RU** tugmasini bosing
2. Interfeys darhol ruschaga o'tadi
3. **Muhim:** yangi dars ishlanmasi formasini oching va **til tanlovini**
   ko'rsating

**Nima aytiladi**

> «Interfeys ruscha, lekin generatsiya tili alohida tanlanadi. Rus tilli
> o'qituvchi o'zbekcha dars ishlanmasini so'rashi mumkin — ikkalasi
> bir-biriga bog'liq emas.»

Bu farqni ta'kidlash muhim: ko'pchilik "ko'p tillilik" deganda faqat
interfeysni tushunadi.

---

## Qo'shimcha (vaqt qolsa, ~30 soniya)

**Kalendar reja** — eng ta'sirli natija, lekin eng uzun kutish.

1. **Kalendar reja** → **Yangi yaratish**
2. Fan: `Matematika`, Davr: `1-chorak` (9 hafta), haftalik `2 soat`
3. Tayyor bo'lgach — jadvalni ko'rsating, keyin **Excel'da oching**

> «Butun chorak uchun darslar jadvali — sanalar bilan, soatlar
> hisoblangan holda. Bu odatda o'qituvchining bir necha soatlik ishi.»

**Diqqat:** bu eng sekin modul — o'lchangan vaqt **52-82 soniya**. Vaqt
tig'iz bo'lsa, uni oldindan yaratib qo'ying va faqat tayyor natijani
ko'rsating. Qisqa davr (`1-chorak`, 9 hafta) uzunroq davrdan tezroq.

---

## Savol-javobga tayyorgarlik

| Savol | Javob |
| --- | --- |
| «AI noto'g'ri javob bersa?» | Har bir natijani o'qituvchi ko'rib chiqadi va tahrirlaydi — bu yordamchi, o'rinbosar emas. Xato bo'lsa bir tugma bilan qayta yaratiladi. |
| «Qaysi AI ishlatilgan?» | Qatlam provider-agnostik: OpenAI, Anthropic, Gemini, OpenRouter — `.env` dagi bir qatorni o'zgartirish kifoya. |
| «Ma'lumotlar xavfsizmi?» | Parollar bcrypt bilan hash qilinadi, sessiyalar bazada saqlanadi va chiqishda bekor qilinadi. Fayllar faqat egasiga beriladi. |
| «Nechta o'qituvchi ishlata oladi?» | Har bir foydalanuvchi o'z ma'lumotini ko'radi. Yuklama chegarasi AI provayderining limitiga bog'liq. |
| «Offline ishlaydimi?» | Yo'q — generatsiya AI xizmatiga bog'liq. Yaratilgan fayllar esa yuklab olingach offline ishlatiladi. |

---

## Agar biror narsa yiqilsa

| Muammo | Nima qilinadi |
| --- | --- |
| Generatsiya uzoq cho'zildi | Gapirishda davom eting — jarayon matni o'zgarib turadi. 1 daqiqadan oshsa, zaxira hisobga o'ting. |
| `FAILED` chiqdi | Bu ham ko'rsatishga arziydi: «tizim xatoni yashirmaydi, sababini aytadi va qayta urinish tugmasini beradi». Keyin tugmani bosing. |
| Internet yo'q | Zaxira hisobdagi tayyor natijalar va yuklab olingan fayllarni ko'rsating. |
| Butunlay ishlamadi | Yuklab olingan `.pptx` va `.xlsx` fayllarni ochib ko'rsating — natija sifati baribir ko'rinadi. |
