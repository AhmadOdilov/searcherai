import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { generateXlsx } from "../lib/xlsx/generate";
import type { CalendarPlanContent, CalendarWeek } from "../lib/validations/calendar-plan";

/**
 * .xlsx generatsiya qatlami sinovlari.
 *
 * Hech narsa mock qilinmaydi — bu qatlam AI'ga, bazaga va sessiyaga
 * bog'lanmagan.
 */

/** .xlsx ham ZIP arxiv — "PK" signature bilan boshlanadi. */
function assertValidXlsx(buffer: Buffer, context: string): void {
  assert.ok(Buffer.isBuffer(buffer), `${context}: Buffer qaytishi kerak`);
  assert.equal(
    buffer.subarray(0, 2).toString("ascii"),
    "PK",
    `${context}: ZIP (PK) signature bo'lishi kerak`,
  );
  assert.ok(
    buffer.length > 3_000,
    `${context}: fayl juda kichik (${buffer.length} bayt)`,
  );
}

/** Yasalgan faylni qayta o'qib, katakchalarni tekshirish uchun. */
async function readBack(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet, "ish varag'i bo'lishi kerak");
  return sheet;
}

function week(overrides: Partial<CalendarWeek> = {}): CalendarWeek {
  return {
    weekNumber: 1,
    dateRange: "14.09.2026 – 20.09.2026",
    topics: [{ name: "Kirish darsi", hours: 2 }],
    ...overrides,
  };
}

function content(overrides: Partial<CalendarPlanContent> = {}): CalendarPlanContent {
  return {
    title: "Matematika — 7-sinf, 1-chorak kalendar-tematik rejasi",
    weeks: [
      week({ weekNumber: 1 }),
      week({ weekNumber: 2, topics: [{ name: "Kasrlar", hours: 2 }] }),
      week({ weekNumber: 3, topics: [{ name: "Nazorat ishi", hours: 2 }] }),
    ],
    ...overrides,
  };
}

describe("generateXlsx — asosiy holat", () => {
  it("haqiqiy .xlsx Buffer qaytaradi", async () => {
    const result = await generateXlsx(content());

    assertValidXlsx(result.buffer, "asosiy holat");
    assert.equal(result.rowCount, 3);
  });

  it("sarlavha, ustun nomlari va ma'lumot qatorlarini yozadi", async () => {
    const result = await generateXlsx(content());
    const sheet = await readBack(result.buffer);

    // 1-qator — hujjat sarlavhasi
    assert.match(
      String(sheet.getCell(1, 1).value),
      /Matematika — 7-sinf/,
      "sarlavha 1-qatorda bo'lishi kerak",
    );

    // 2-qator — ustun nomlari
    assert.equal(sheet.getCell(2, 1).value, "Hafta");
    assert.equal(sheet.getCell(2, 2).value, "Sana oralig'i");
    assert.equal(sheet.getCell(2, 3).value, "Mavzu");
    assert.equal(sheet.getCell(2, 4).value, "Soat");
    assert.equal(sheet.getCell(2, 5).value, "Izoh");

    // 3-qator — birinchi ma'lumot
    assert.equal(sheet.getCell(3, 1).value, 1);
    assert.equal(sheet.getCell(3, 3).value, "Kirish darsi");
    assert.equal(sheet.getCell(3, 4).value, 2);
  });

  it("sarlavha qatori QALIN, rangli fon va oq matn bilan", async () => {
    const result = await generateXlsx(content());
    const sheet = await readBack(result.buffer);

    const headerCell = sheet.getCell(2, 1);
    assert.equal(headerCell.font?.bold, true, "qalin bo'lishi kerak");
    assert.equal(headerCell.font?.color?.argb, "FFFFFFFF", "matn oq bo'lishi kerak");
    assert.equal(headerCell.fill?.type, "pattern", "fon rangi bo'lishi kerak");
  });

  it("BARCHA katakchalarga chegara qo'yadi", async () => {
    const result = await generateXlsx(content());
    const sheet = await readBack(result.buffer);

    // Sarlavha qatoridan jami qatorigacha
    for (let row = 2; row <= 6; row++) {
      for (let column = 1; column <= 5; column++) {
        const border = sheet.getCell(row, column).border;
        assert.ok(
          border?.top && border?.left && border?.bottom && border?.right,
          `(${row}, ${column}) katakchasida chegara yo'q`,
        );
      }
    }
  });

  it("sarlavha qatorini QOTIRADI (freeze panes)", async () => {
    const result = await generateXlsx(content());
    const sheet = await readBack(result.buffer);

    const view = sheet.views[0];
    assert.equal(view?.state, "frozen", "qotirilgan bo'lishi kerak");
    assert.equal(
      (view as { ySplit?: number }).ySplit,
      2,
      "birinchi ikki qator qotirilishi kerak",
    );
  });

  it("BARCHA ustunlarga kenglik beradi", async () => {
    const result = await generateXlsx(content());
    const sheet = await readBack(result.buffer);

    /*
      Har bir ustun tekshiriladi, faqat "keng/tor" nisbati emas.

      Sabab: ExcelJS 9 ni o'zining standart kengligi deb biladi va aynan
      shu qiymatni faylga yozmaydi. Ilgari hafta ustuni 9 edi va uning
      kengligi jim yo'qolardi — nisbatni tekshiradigan sinov buni
      sezmagan edi.
    */
    for (let column = 1; column <= 5; column++) {
      const width = sheet.getColumn(column).width;
      assert.ok(
        typeof width === "number" && width > 0,
        `${column}-ustun kengligi yo'qolgan (${width})`,
      );
    }

    // Mavzu ustuni eng keng, soat ustuni eng tor bo'lishi kerak.
    assert.ok(
      sheet.getColumn(3).width! > sheet.getColumn(4).width! * 3,
      "mavzu ustuni ancha keng bo'lsin",
    );
  });

  it("oxirida JAMI qatorini qo'shadi", async () => {
    const result = await generateXlsx(
      content({
        weeks: [
          week({ weekNumber: 1, topics: [{ name: "A", hours: 2 }] }),
          week({ weekNumber: 2, topics: [{ name: "B", hours: 3 }] }),
        ],
      }),
    );
    const sheet = await readBack(result.buffer);

    // 3, 4 — ma'lumot; 5 — jami
    assert.equal(sheet.getCell(5, 3).value, "Jami");
    assert.equal(sheet.getCell(5, 4).value, 5, "soatlar yig'indisi");
  });

  it("bitta haftada bir nechta mavzu bo'lsa hafta katakchalarini birlashtiradi", async () => {
    const result = await generateXlsx(
      content({
        weeks: [
          week({
            weekNumber: 1,
            topics: [
              { name: "Birinchi mavzu", hours: 1 },
              { name: "Ikkinchi mavzu", hours: 1 },
            ],
          }),
        ],
      }),
    );
    const sheet = await readBack(result.buffer);

    assert.equal(result.rowCount, 2);
    // Birlashtirilgan katakchada qiymat birinchi qatorda turadi.
    assert.equal(sheet.getCell(3, 1).value, 1);
    assert.equal(sheet.getCell(3, 3).value, "Birinchi mavzu");
    assert.equal(sheet.getCell(4, 3).value, "Ikkinchi mavzu");
  });
});

describe("generateXlsx — tillar", () => {
  it("ustun nomlari tilga qarab o'zgaradi", async () => {
    const ru = await readBack((await generateXlsx(content(), "RU")).buffer);
    assert.equal(ru.getCell(2, 1).value, "Неделя");
    assert.equal(ru.getCell(2, 3).value, "Тема");

    const en = await readBack((await generateXlsx(content(), "EN")).buffer);
    assert.equal(en.getCell(2, 1).value, "Week");
    assert.equal(en.getCell(2, 3).value, "Topic");
  });

  it("ish varag'i nomi ham tarjima qilinadi", async () => {
    const workbook = new ExcelJS.Workbook();
    const result = await generateXlsx(content(), "RU");
    await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);

    assert.equal(workbook.worksheets[0].name, "Календарный план");
  });

  it("jami yorlig'i ham tarjima qilinadi", async () => {
    const en = await readBack((await generateXlsx(content(), "EN")).buffer);
    // 3 hafta × 1 mavzu = 3 qator, jami — 6-qator
    assert.equal(en.getCell(6, 3).value, "Total");
  });
});

describe("generateXlsx — chegara holatlari", () => {
  it("BO'SH haftalar massivi bilan xato bermaydi", async () => {
    const result = await generateXlsx(content({ weeks: [] }));

    assertValidXlsx(result.buffer, "bo'sh haftalar");
    assert.equal(result.rowCount, 0);
  });

  it("izohsiz mavzular bilan ishlaydi", async () => {
    const result = await generateXlsx(
      content({
        weeks: [week({ topics: [{ name: "Izohsiz mavzu", hours: 2 }] })],
      }),
    );
    const sheet = await readBack(result.buffer);

    assertValidXlsx(result.buffer, "izohsiz");
    assert.equal(sheet.getCell(3, 5).value, "");
  });

  it("JUDA UZUN mavzu nomi bilan xato bermaydi (qisqartiradi)", async () => {
    const veryLongTopic = "Juda uzun mavzu nomi ".repeat(500);

    const result = await generateXlsx(
      content({
        weeks: [
          week({
            topics: [{ name: veryLongTopic, hours: 2, note: veryLongTopic }],
          }),
        ],
      }),
    );
    const sheet = await readBack(result.buffer);

    assertValidXlsx(result.buffer, "uzun mavzu");
    const written = String(sheet.getCell(3, 3).value);
    assert.ok(
      written.length <= 4000,
      `katakcha matni qisqartirilishi kerak (${written.length})`,
    );
  });

  it("o'zbek lotin, kirill va maxsus belgilar bilan ishlaydi", async () => {
    const result = await generateXlsx(
      content({
        title: "Oʻzbek tili — 7-sinf, gʻoyalar",
        weeks: [
          week({
            topics: [
              { name: "Oʻzlashtirish: oʻ gʻ ʻ va o' g'", hours: 2 },
              { name: "Русская тема — с тире", hours: 1, note: "Примечание" },
              { name: "Maxsus: & < > \" ' © → ✓ №", hours: 1, note: "100% < 200%" },
            ],
          }),
        ],
      }),
    );
    const sheet = await readBack(result.buffer);

    assertValidXlsx(result.buffer, "maxsus harflar");
    assert.match(String(sheet.getCell(3, 3).value), /Oʻzlashtirish/);
    assert.match(String(sheet.getCell(4, 3).value), /Русская/);
    assert.match(String(sheet.getCell(5, 3).value), /&/);
  });

  it("emoji va yangi qatorlar bilan ham yiqilmaydi", async () => {
    const result = await generateXlsx(
      content({
        weeks: [
          week({
            topics: [{ name: "Mavzu 📚", hours: 1, note: "Ikki\nqatorli izoh" }],
          }),
        ],
      }),
    );

    assertValidXlsx(result.buffer, "emoji va yangi qator");
  });

  it("100+ qatorli reja bilan ishlaydi", async () => {
    // Bir o'quv yili: 36 hafta × 3 mavzu = 108 qator.
    const manyWeeks: CalendarWeek[] = Array.from({ length: 36 }, (_, index) => ({
      weekNumber: index + 1,
      dateRange: `Hafta ${index + 1}`,
      topics: [
        { name: `Mavzu ${index * 3 + 1}`, hours: 1 },
        { name: `Mavzu ${index * 3 + 2}`, hours: 1 },
        { name: `Mavzu ${index * 3 + 3}`, hours: 1, note: "Izoh" },
      ],
    }));

    const result = await generateXlsx(content({ weeks: manyWeeks }));
    const sheet = await readBack(result.buffer);

    assertValidXlsx(result.buffer, "108 qator");
    assert.equal(result.rowCount, 108);
    // Jami qatori: 2 (sarlavhalar) + 108 = 110, jami — 111
    assert.equal(sheet.getCell(111, 4).value, 108, "jami soat 108 bo'lishi kerak");
    // Qotirish uzun jadvalda ayniqsa muhim.
    assert.equal(sheet.views[0]?.state, "frozen");
  });

  it("har xil kirish uchun har xil fayl chiqadi", async () => {
    const first = await generateXlsx(content({ title: "Birinchi reja" }));
    const second = await generateXlsx(
      content({
        title: "Ikkinchi reja",
        weeks: [week({ topics: [{ name: "Butunlay boshqa mavzu", hours: 5 }] })],
      }),
    );

    assert.notEqual(first.buffer.length, second.buffer.length);
  });
});
