import ExcelJS from "exceljs";
import type { LanguageCode } from "@/lib/validations/common";
import type { CalendarPlanContent } from "@/lib/validations/calendar-plan";
import {
  COLORS,
  COLUMNS,
  COLUMN_HEADERS,
  FONT,
  SHEET_NAMES,
  THIN_BORDER,
  TOTAL_LABELS,
} from "@/lib/xlsx/theme";

/**
 * .xlsx generatsiya qatlami.
 *
 * ── Bu qatlam AI'dan MUSTAQIL ─────────────────────────────────────────────
 * `lib/pptx/generate.ts` bilan bir xil yondashuv: kirish — reja JSON'i,
 * chiqish — .xlsx Buffer. Bazaga, sessiyaga, AI'ga yoki muhit
 * o'zgaruvchilariga bog'lanmagan. Shuning uchun sinovda hech narsa mock
 * qilmasdan chaqiriladi.
 */

export interface GenerateXlsxResult {
  buffer: Buffer;
  rowCount: number;
}

/** Excel katakchasiga sig'adigan maksimal matn (32767 — Excel chegarasi). */
const MAX_CELL_CHARS = 4000;

/**
 * Butun son formati.
 *
 * Soat va hafta raqami kasr bo'lmaydi: "2,0" yoki "2,00" ko'rinishi
 * jadvalni hujjatga o'xshamaydigan qiladi.
 */
const INTEGER_FORMAT = "0";

/** Excel ish varag'i nomidagi taqiqlangan belgilar. */
const INVALID_SHEET_CHARS = /[[\]:*?/\\]/g;

/**
 * Kalendar reja JSON'idan .xlsx fayl yasaydi.
 *
 * `generatePptx` kabi, chegaradan oshgan kirishni XATO QILMAYDI, balki
 * xavfsiz qiymatga keltiradi. Sabab o'sha: bu qatlam oqimning OXIRIDA
 * turadi — bu yerda yiqilish butun generatsiyaning bekor ketishini
 * bildiradi, holbuki bir oz qisqartirilgan matn bilan ham yaroqli fayl
 * chiqadi.
 */
export async function generateXlsx(
  content: CalendarPlanContent,
  language: LanguageCode = "UZ",
): Promise<GenerateXlsxResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Searcher AI";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName(language), {
    views: [
      {
        /*
          Sarlavha qatorini qotirish.

          `ySplit: 2` — birinchi ikki qator (hujjat sarlavhasi + ustun
          nomlari) joyida qoladi. Kalendar reja 30-70 qator bo'lishi mumkin;
          pastga tushganda ustun nomlari ko'rinmasa, jadvalni o'qib
          bo'lmaydi.
        */
        state: "frozen",
        ySplit: 2,
      },
    ],
    pageSetup: {
      // Bosib chiqarishda ustunlar bitta varaq kengligiga sig'sin.
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      orientation: "landscape",
    },
  });

  const headers = COLUMN_HEADERS[language];

  // Ustun kengliklari
  sheet.columns = COLUMNS.map((column) => ({ width: column.width }));

  // ── 1-qator: hujjat sarlavhasi (ustunlar bo'ylab birlashtirilgan) ──────
  sheet.mergeCells(1, 1, 1, COLUMNS.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = clamp(content.title, 200);
  titleCell.font = {
    name: FONT.family,
    size: FONT.titleSize,
    bold: true,
    color: { argb: COLORS.text },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 24;

  // ── 2-qator: ustun nomlari ─────────────────────────────────────────────
  const headerRow = sheet.getRow(2);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = {
      name: FONT.family,
      size: FONT.headerSize,
      bold: true,
      color: { argb: COLORS.headerText },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerFill },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;

  // ── Ma'lumot qatorlari ─────────────────────────────────────────────────
  let rowIndex = 3;
  let dataRowCount = 0;
  let totalHours = 0;

  for (const week of content.weeks) {
    const firstRowOfWeek = rowIndex;

    for (const topic of week.topics) {
      const row = sheet.getRow(rowIndex);

      row.getCell(1).value = week.weekNumber;
      row.getCell(2).value = clamp(week.dateRange, 100);
      row.getCell(3).value = clamp(topic.name, MAX_CELL_CHARS);
      /*
        Soat — MATN emas, son.

        `numFmt` ni ataylab qo'yamiz: busiz Excel soatni "umumiy"
        (General) formatda ko'rsatadi va o'qituvchi katakchani tahrirlab
        "2 " deb yozsa, u matnga aylanadi — shunda `SUM` uni hisobga
        olmaydi va jami jim noto'g'ri chiqadi.
      */
      row.getCell(4).value = topic.hours;
      row.getCell(4).numFmt = INTEGER_FORMAT;
      row.getCell(1).numFmt = INTEGER_FORMAT;
      row.getCell(5).value =
        topic.note === undefined ? "" : clamp(topic.note, MAX_CELL_CHARS);

      styleDataRow(row, headers.length);
      totalHours += topic.hours;
      dataRowCount++;
      rowIndex++;
    }

    /*
      Bitta haftada bir nechta mavzu bo'lsa, hafta raqami va sanasini
      birlashtiramiz — jadval "1, 1, 1, 2, 2" o'rniga "1, 2" ko'rinishida
      o'qiladi va haftalar chegarasi ko'zga tashlanadi.
    */
    const lastRowOfWeek = rowIndex - 1;
    if (lastRowOfWeek > firstRowOfWeek) {
      sheet.mergeCells(firstRowOfWeek, 1, lastRowOfWeek, 1);
      sheet.mergeCells(firstRowOfWeek, 2, lastRowOfWeek, 2);
      for (const column of [1, 2]) {
        sheet.getCell(firstRowOfWeek, column).alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
      }
    }
  }

  // ── Jami qatori ────────────────────────────────────────────────────────
  if (dataRowCount > 0) {
    const totalRow = sheet.getRow(rowIndex);
    totalRow.getCell(3).value = TOTAL_LABELS[language];

    /*
      Jami — TAYYOR SON emas, `SUM` formulasi.

      Kalendar reja hech qachon birinchi ko'rinishida qolmaydi:
      o'qituvchi mavzuni ko'chiradi, soatni 2 dan 1 ga tushiradi, qator
      qo'shadi. Tayyor son yozilganda jami o'sha eski qiymatda qotib
      qolardi — va aynan shu raqam o'quv bo'limiga topshiriladigan
      hujjatga tushadi. Formula esa tahrirdan keyin o'zi qayta hisoblaydi.

      `result` ham beriladi: Excel faylni ochib formulani hisoblaguncha
      katakchada shu qiymat turadi. Busiz ba'zi ko'ruvchilar (Google
      Sheets'ning tez ko'rinishi, telefondagi ba'zi ilovalar) bo'sh
      katakcha ko'rsatadi.
    */
    const firstDataRow = 3;
    const lastDataRow = rowIndex - 1;
    totalRow.getCell(4).value = {
      formula: `SUM(D${firstDataRow}:D${lastDataRow})`,
      result: totalHours,
    };
    totalRow.getCell(4).numFmt = INTEGER_FORMAT;

    for (let column = 1; column <= headers.length; column++) {
      const cell = totalRow.getCell(column);
      cell.font = {
        name: FONT.family,
        size: FONT.bodySize,
        bold: true,
        color: { argb: COLORS.text },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.weekFill },
      };
      cell.border = THIN_BORDER;
      cell.alignment =
        column === 4
          ? { vertical: "middle", horizontal: "center" }
          : { vertical: "middle", horizontal: column === 3 ? "right" : "center" };
    }
  }

  // `writeBuffer` ArrayBuffer-ga o'xshash qiymat qaytaradi — Buffer'ga o'giramiz.
  const arrayBuffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(arrayBuffer as ArrayBuffer),
    rowCount: dataRowCount,
  };
}

/** Ma'lumot qatorining ko'rinishi. */
function styleDataRow(row: ExcelJS.Row, columnCount: number): void {
  for (let column = 1; column <= columnCount; column++) {
    const cell = row.getCell(column);

    cell.font = {
      name: FONT.family,
      size: FONT.bodySize,
      color: { argb: column === 5 ? COLORS.muted : COLORS.text },
    };
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: "top",
      // Hafta raqami va soat — markazda; matn — chapda.
      horizontal: column === 1 || column === 4 ? "center" : "left",
      // Uzun mavzu nomi kesilmasin, katakcha ichida qatorlarga bo'linsin.
      wrapText: column === 3 || column === 5,
    };
  }
}

/**
 * Ish varag'i nomini Excel qoidalariga moslaydi: 31 belgidan oshmasligi va
 * `[ ] : * ? / \` belgilarini o'z ichiga olmasligi kerak, aks holda faylni
 * ochib bo'lmaydi.
 */
function sheetName(language: LanguageCode): string {
  return SHEET_NAMES[language].replace(INVALID_SHEET_CHARS, " ").slice(0, 31);
}

/** Matnni belgilangan uzunlikka keltiradi. */
function clamp(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}
