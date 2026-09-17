# SEARCHER AI — MULTI-TURN V3 PERSISTENT CONVERSATION SPECIFICATION (PHASE 14)

## 1. Executive Summary & Design Decision

Searcher AI V2 va V3 arxitekturasida ko'p bosqichli suhbat konteksti (`ConversationTurnContext`) **mijoz tomonida (stateless / client-driven)** boshqariladi:
* Frontend har bir navbatdagi so'rovda oldingi fanni (`previousSubject`), sinfni (`previousGrade`), mavzuni (`previousTopic`) va tilni (`previousLanguage`) xavfsiz JSON sarlavhasida uzatadi.
* Backend esa ushbu kontekstdan foydalanib, yangi mavzu kiritilmagan bo'lsa oldingi mavzuni saqlab qoladi (`understandQuery`).

**Nega hozir darhol bazaga migratsiya (`Conversation`, `ConversationTurn`) qilinmadi:**
* Foydalanuvchi qidiruv tarixini (search history UI) so'ramagan paytda bazada har bir so'rovni yozib borish — xotirani behuda to'ldirish, qidiruv kechikishini (latency) oshirish va foydalanuvchi maxfiyligini xavf ostiga qo'yish demakdir.
* Quyida kelgusida foydalanuvchi "Qidiruv tarixi" funksiyasini talab qilganida joriy etilishi lozim bo'lgan **to'liq arxitektura talablari va loyihasi** belgilandi.

---

## 2. Talablar Tahlili (Key Requirements)

### 2.1. Storage Size (Xotira hajmi va rejalashtirish)
* O'rtacha 1 ta so'rov va uning konteksti: ~1.5 KB (savol matni + normalizatsiya + AI xulosasi).
* 1 000 ta faol o'qituvchi kuniga 10 tadan qidiruv qilsa:
  * Kunlik: `10,000 so'rov * 1.5 KB = 15 MB`.
  * Oylik: `450 MB`.
  * Yillik: `~5.4 GB`.
* **Xulosa:** Cheklovsiz saqlash PostgreSQL bazasini bir necha oyda sekinlashtirishi mumkin. Shuning uchun indekslash va avtomatik tozalash majburiydir.

### 2.2. Privacy & Data Protection (Maxfiylik va Shaxsiy Ma'lumotlar)
* Qidiruv so'rovlarida o'quvchilar ismi, maktab ichki nizolari yoki shaxsiy ma'lumotlar uchrashi mumkin.
* Barcha matnlar saqlanishidan oldin PII (Personally Identifiable Information) filtridan o'tkazilishi lozim.
* Foydalanuvchi o'z tarixini ko'rishi mumkin, lekin boshqa o'qituvchilar yoki ma'murlar ruxsatsiz o'qiy olmasligi shart (Row Level Security yoki qat'iy `userId` tekshiruvi).

### 2.3. Retention Policy (Eskirish va Saqlash muddati)
* Standart saqlash muddati: **30 kun**.
* 30 kundan oshgan suhbat navbatlari avtomatik ravishda `pg_cron` yoki foniy tozalash xizmati orqali o'chiriladi.
* Faqatgina foydalanuvchi tomonidan "Saqlangan qidiruvlar" (Bookmarked searches) deb belgilangan yozuvlar saqlanib qoladi.

### 2.4. User Ownership & Deletion (Foydalanuvchi egaligi va O'chirish huquqi)
* Foydalanuvchi istalgan payt "Qidiruv tarixini tozalash" (Clear History) tugmasi orqali barcha yozuvlarini bir zumda tozalash huquqiga ega bo'lishi shart.
* Foydalanuvchi akkaunti o'chirilganda `onDelete: Cascade` orqali uning barcha suhbatlari bazadan butunlay yo'qolishi ta'minlanadi.

### 2.5. Performance & Latency (Tezlik va Kechikish ta'siri)
* Qidiruvning asosiy maqsadi: **< 10ms retrieval va tezkor kesh**.
* Agar har bir qidiruv oldidan sessiya tarixini bazadan yuklash (Read DB) va har bir javobdan so'ng yozish (Write DB) majburiy bo'lsa:
  * DB I/O yuklamasi 2 barobar oshadi.
  * Cold qidiruv kechikishi +5-12ms ga ko'payadi.
* Shuning uchun persistent yozish jarayoni faqat **asinxron (non-blocking background task)** tarzda amalga oshirilishi shart.

---

## 3. Kelgusi Prisma Modeli Loyihasi (Draft Schema)

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String?  // Masalan, "5-sinf Matematika: Natural sonlar"
  subject   String?
  grade     String?
  language  Language @default(UZ)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  turns     ConversationTurn[]

  @@index([userId, updatedAt])
}

model ConversationTurn {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  userQuery      String
  detectedIntent String
  aiAnswer       Json         // SearchAnswer shakli
  isGrounded     Boolean      @default(true)
  durationMs     Int

  createdAt      DateTime     @default(now())

  @@index([conversationId, createdAt])
}
```

---

## 4. Yakuniy Xulosa

* Hozirgi bosqichda V2 da ishlayotgan **frontend-driven context** 100% saqlandi va xotirani band qilmasdan, 0ms kechikish bilan eng yuqori aniqlikni bermoqda.
* Yuqoridagi spetsifikatsiya foydalanuvchi tomonlama UI talabi paydo bo'lganda zudlik bilan xavfsiz migratsiya qilish uchun to'liq tayyor.
