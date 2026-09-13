import "server-only";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { LessonPlanContent } from "@/lib/validations/lesson-plan";

/**
 * Dars ishlanmasidan Word hujjati (.docx) yasaydi.
 *
 * ── Nega Word kerak ───────────────────────────────────────────────────────
 * O'qituvchi dars ishlanmasini ekranda o'qish uchun emas, MAKTABGA
 * TOPSHIRISH uchun oladi: uni chop etadi, direktor o'rinbosariga beradi,
 * ba'zan o'z qo'li bilan tahrirlaydi. Bu ishlarning hammasi Word'da
 * bo'ladi — PDF ham, HTML ham bunga yaramaydi.
 *
 * ── Nega fayl SAQLANMAYDI ─────────────────────────────────────────────────
 * .pptx va .xlsx dan farqli o'laroq, bu hujjat diskka yozilmaydi: har
 * so'rovda bazadagi mazmundan qayta yasaladi (~50 ms). Sabab — dars
 * ishlanmasi qayta generatsiya qilinishi mumkin, saqlangan fayl esa jim
 * eskirib qolardi va o'qituvchi eski versiyani yuklab olardi.
 *
 * ── Shrift haqida ─────────────────────────────────────────────────────────
 * O'zbek lotin alifbosidagi `o'` va `g'` hamda kirill harflari uchun
 * shrift Unicode'ni qo'llab-quvvatlashi kerak. Calibri (Word standarti)
 * ikkalasini ham biladi; hujjatga shrift EMBED qilinmaydi, foydalanuvchi
 * kompyuteridagi shrift ishlatiladi.
 */

/** Hujjatdagi sarlavhalar — chaqiruvchi tomondan tarjima qilib beriladi. */
export interface DocxLabels {
  subject: string;
  grade: string;
  duration: string;
  lessonType: string;
  objective: string;
  outcomes: string;
  resources: string;
  stages: string;
  /** Jadval ustunining nomi — bo'lim sarlavhasidan ("Dars bosqichlari") farqli. */
  stageColumn: string;
  assessment: string;
  teacher: string;
  students: string;
  minutes: (value: number) => string;
  totalMinutes: (value: number) => string;
}

export interface DocxInput {
  topic: string;
  subject: string;
  grade: string;
  durationMinutes: number;
  lessonTypeName: string;
  content: LessonPlanContent;
  labels: DocxLabels;
}

const FONT = "Calibri";

export async function generateLessonPlanDocx(input: DocxInput): Promise<Buffer> {
  const { content, labels } = input;

  const children: Paragraph[] = [];

  // ── Sarlavha ───────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: input.topic, bold: true, size: 32 })],
    }),
  );

  // Fan, sinf, davomiylik, tur — bitta qatorda, chunki ular birga o'qiladi.
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: [
            `${labels.subject}: ${input.subject}`,
            `${labels.grade}: ${input.grade}`,
            `${labels.duration}: ${labels.minutes(input.durationMinutes)}`,
            `${labels.lessonType}: ${input.lessonTypeName}`,
          ].join("   ·   "),
          size: 20,
          color: "555555",
        }),
      ],
    }),
  );

  // ── Maqsad ─────────────────────────────────────────────────────────────
  children.push(heading(labels.objective));
  children.push(body(content.objective));

  // ── Kutilayotgan natijalar ─────────────────────────────────────────────
  children.push(heading(labels.outcomes));
  for (const outcome of content.outcomes) {
    children.push(bullet(outcome));
  }

  // ── Resurslar ──────────────────────────────────────────────────────────
  children.push(heading(labels.resources));
  for (const resource of content.resources) {
    children.push(bullet(resource));
  }

  // ── Bosqichlar ─────────────────────────────────────────────────────────
  children.push(heading(labels.stages));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          ...children,
          stagesTable(input),
          new Paragraph({
            spacing: { before: 120, after: 360 },
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: labels.totalMinutes(
                  content.stages.reduce((sum, stage) => sum + stage.durationMinutes, 0),
                ),
                bold: true,
                size: 20,
              }),
            ],
          }),
          ...assessmentSection(content, labels),
        ],
      },
    ],
  });

  // `Packer.toBuffer` Node'da Buffer qaytaradi; tur ta'rifi Uint8Array
  // ko'rsatadi, shuning uchun aniq o'giramiz.
  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Bosqichlar JADVAL ko'rinishida.
 *
 * Nega jadval: maktabga topshiriladigan ishlanmada bosqichlar deyarli
 * har doim jadval bo'lib ketadi — "bosqich / vaqt / o'qituvchi /
 * o'quvchilar". Matn ro'yxati bo'lsa o'qituvchi uni qo'lda jadvalga
 * ko'chirishga majbur bo'lardi.
 */
function stagesTable(input: DocxInput): Table {
  const { content, labels } = input;

  const header = new TableRow({
    tableHeader: true,
    children: [
      headerCell("№", 6),
      headerCell(labels.stageColumn, 26),
      headerCell(labels.duration, 12),
      headerCell(labels.teacher, 28),
      headerCell(labels.students, 28),
    ],
  });

  const rows = content.stages.map(
    (stage, index) =>
      new TableRow({
        children: [
          cell(String(index + 1), 6),
          cell(stage.name, 26, { bold: true, note: stage.description }),
          cell(labels.minutes(stage.durationMinutes), 12),
          cell(stage.teacherActivity, 28),
          cell(stage.studentActivity, 28),
        ],
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

function assessmentSection(content: LessonPlanContent, labels: DocxLabels): Paragraph[] {
  if (
    content.assessmentCriteria === undefined ||
    content.assessmentCriteria.length === 0
  ) {
    return [];
  }
  return [heading(labels.assessment), ...content.assessmentCriteria.map(bullet)];
}

// ─── Kichik yordamchilar ─────────────────────────────────────────────────────

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "0F766E" })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function headerCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: "F0FDFA" },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, color: "115E59" })],
      }),
    ],
  });
}

function cell(
  text: string,
  widthPercent: number,
  options: { bold?: boolean; note?: string } = {},
): TableCell {
  const paragraphs = [
    new Paragraph({
      children: [new TextRun({ text, size: 20, bold: options.bold === true })],
    }),
  ];

  // Bosqich tavsifi nomi ostida kichikroq shriftda — alohida ustun
  // ochilsa jadval juda tor bo'lib ketardi.
  if (options.note !== undefined && options.note !== "") {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40 },
        children: [new TextRun({ text: options.note, size: 18, color: "555555" })],
      }),
    );
  }

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    children: paragraphs,
  });
}
