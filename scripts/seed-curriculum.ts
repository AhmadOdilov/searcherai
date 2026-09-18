/**
 * O'quv dasturi JSON fayllarini bazaga yuklaydi.
 *
 * Ishlatish:
 *   npm run db:seed-curriculum              # data/curriculum/*.json hammasi
 *   npm run db:seed-curriculum -- mat*.json # faqat moslari
 *   npm run db:seed-curriculum -- --sql     # bazaga yozmay, SQL chiqaradi
 *
 * ── `--sql` nima uchun ────────────────────────────────────────────────────
 * Productionda baza konteyner ichida va u yerda `tsx` ham, bu skript
 * ham yo'q (migratsiya image'i ataylab kichik). Shuning uchun SQL
 * mahalliy mashinada yasalib, serverga quyiladi:
 *
 *   npm run db:seed-curriculum -- --sql > dastur.sql
 *   docker compose -f docker-compose.prod.yml exec -T postgres \
 *     psql -U searcher -d searcher_ai < dastur.sql
 *
 * ── Qayta ishga tushirish XAVFSIZ ─────────────────────────────────────────
 * Har bir fayl uchun avval o'sha fan-sinf juftligining ESKI qatorlari
 * o'chiriladi, so'ng yangilari yoziladi. Ya'ni skriptni ikki marta
 * ishga tushirsangiz nusxalar paydo bo'lmaydi.
 *
 * Nega `upsert` emas: dasturda bo'lim nomi o'zgarishi mumkin, o'shanda
 * `upsert` eski nomni jadvalda qoldirib ketardi va AI promptiga ikki
 * xil ro'yxat tushardi.
 *
 * ── Yangi fan-sinf qo'shish ───────────────────────────────────────────────
 *   1. Rasmiy PDF'ni yuklab oling (manba: DEPLOY.md / hisobotdagi havola)
 *   2. pdftotext -layout -enc UTF-8 dastur.pdf dastur.txt
 *   3. npx tsx scripts/extract-curriculum.ts dastur.txt "Fizika" 8 <havola> \
 *        > data/curriculum/fizika-8.json
 *   4. JSON'ni KO'Z BILAN tekshiring (bo'lim nomlari, soatlar)
 *   5. npm run db:seed-curriculum
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../lib/db";
import { curriculumTopicId } from "../lib/curriculum/topic-id";

const DATA_DIR = path.join(process.cwd(), "data", "curriculum");

/**
 * Fayl shakli — `extract-curriculum.ts` chiqaradigan JSON.
 *
 * Tekshiruv QAT'IY: buzuq fayl bazaga tushib, keyin AI promptiga
 * kirib ketishidan ko'ra, yuklashda to'xtagani yaxshi.
 */
const fileSchema = z.object({
  subject: z.string().trim().min(2),
  grade: z.string().trim().min(1),
  source: z.string().default(""),
  topics: z
    .array(
      z.object({
        topicName: z.string().trim().min(3),
        description: z.string().trim().default(""),
        expectedHours: z.number().int().positive().nullable(),
        expectedOutcomes: z.array(z.string().trim().min(5)).default([]),
      }),
    )
    .min(1, "faylda birorta ham mavzu yo'q"),
});

/** SQL satri uchun matnni xavfsiz qilish. */
function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Bir faylni `DELETE` + `INSERT` SQL'iga aylantiradi. */
function toSql(data: z.infer<typeof fileSchema>): string {
  const { subject, grade, source, topics } = data;

  const lines = [
    `DELETE FROM "CurriculumTopic" WHERE subject = ${quote(subject)} AND grade = ${quote(grade)};`,
  ];

  topics.forEach((topic, index) => {
    const outcomes =
      topic.expectedOutcomes.length === 0
        ? "ARRAY[]::text[]"
        : `ARRAY[${topic.expectedOutcomes.map(quote).join(", ")}]`;

    /*
      id `gen_random_uuid()` EMAS: SQL va TS yo'llari aynan bir xil
      deterministik id berishi shart (lib/curriculum/topic-id.ts).
      Aks holda production (SQL) va dev (TS) bazalarida bir xil bo'lim
      turli id oladi va dalil havolalari muhitga bog'lanib qoladi.
    */
    const id = curriculumTopicId(subject, grade, topic.topicName, index);

    lines.push(
      `INSERT INTO "CurriculumTopic" (id, subject, grade, "topicName", description, "expectedHours", "expectedOutcomes", source) ` +
        `VALUES (${quote(id)}, ${quote(subject)}, ${quote(grade)}, ${quote(topic.topicName)}, ` +
        `${quote(topic.description)}, ${topic.expectedHours ?? "NULL"}, ${outcomes}, ${quote(source)});`,
    );
  });

  return lines.join("\n");
}

async function seedFile(fileName: string): Promise<{ subject: string; count: number }> {
  const { subject, grade, source, topics } = readFile(fileName);

  /*
    Eski qatorlarni o'chirib, yangisini yozamiz — bitta tranzaksiyada.
    Aks holda o'chirish bilan yozish orasida qidiruv BO'SH natija
    qaytarishi mumkin edi.
  */
  await prisma.$transaction([
    prisma.curriculumTopic.deleteMany({ where: { subject, grade } }),
    prisma.curriculumTopic.createMany({
      data: topics.map((topic, index) => ({
        id: curriculumTopicId(subject, grade, topic.topicName, index),
        subject,
        grade,
        topicName: topic.topicName,
        description: topic.description,
        expectedHours: topic.expectedHours,
        expectedOutcomes: topic.expectedOutcomes,
        source,
      })),
    }),
  ]);

  return { subject: `${subject} ${grade}`, count: topics.length };
}

/** Faylni o'qiydi va tekshiradi — ikkala rejim uchun umumiy. */
function readFile(fileName: string): z.infer<typeof fileSchema> {
  const raw: unknown = JSON.parse(readFileSync(path.join(DATA_DIR, fileName), "utf8"));
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${fileName} — noto'g'ri shakl:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sqlMode = args.includes("--sql");
  const filter = args.filter((arg) => !arg.startsWith("--"));

  const files = readdirSync(DATA_DIR)
    .filter((name) => name.endsWith(".json"))
    .filter(
      (name) => filter.length === 0 || filter.some((pattern) => name.includes(pattern)),
    );

  if (files.length === 0) {
    console.error(`${DATA_DIR} ichida mos JSON fayl topilmadi.`);
    process.exit(1);
  }

  if (sqlMode) {
    // Faqat SQL chiqaradi — bazaga ulanmaydi ham.
    const blocks = files.map((file) => toSql(readFile(file)));
    console.log(["BEGIN;", ...blocks, "COMMIT;"].join("\n\n"));
    return;
  }

  let total = 0;
  for (const file of files) {
    const result = await seedFile(file);
    total += result.count;
    console.log(
      `  ✓ ${result.subject.padEnd(22)} ${String(result.count).padStart(3)} mavzu`,
    );
  }

  console.log(`\nJami ${total} mavzu, ${files.length} ta fan-sinf juftligi.`);
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
