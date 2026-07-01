import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outDir = "/Users/kyle/codex project/Duo Cloud/outputs/knowledge_cloud_import_20260630";
const payload = JSON.parse(await fs.readFile(path.join(outDir, "knowledge_cloud_import_data.json"), "utf8"));

const outputXlsx = path.join(outDir, "品特烫金膜知识云字段导入表_20260630.xlsx");

function colLetter(indexZero) {
  let n = indexZero + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function matrixFromRows(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ""))];
}

function safeTableName(code) {
  return `${code.replace(/[^A-Za-z0-9_]/g, "_")}_Import`;
}

function applySheetStyle(sheet, rowCount, colCount) {
  if (rowCount < 1 || colCount < 1) return;
  const last = `${colLetter(colCount - 1)}${rowCount}`;
  const used = sheet.getRange(`A1:${last}`);
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);

  const header = sheet.getRange(`A1:${colLetter(colCount - 1)}1`);
  header.format = {
    fill: "#1F4E5F",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  header.format.rowHeightPx = 34;

  used.format = {
    font: { name: "Arial", size: 10, color: "#1F2933" },
    verticalAlignment: "top",
    wrapText: true,
  };
  used.format.borders = {
    insideHorizontal: { style: "thin", color: "#E5E7EB" },
    top: { style: "thin", color: "#CBD5E1" },
    bottom: { style: "thin", color: "#CBD5E1" },
  };

  const metaStart = Math.max(1, colCount - payload.meta_columns.length + 1);
  const metaRange = sheet.getRange(`${colLetter(metaStart - 1)}1:${colLetter(colCount - 1)}${rowCount}`);
  metaRange.format.fill = "#F8FAFC";

  const widths = [];
  for (let i = 0; i < colCount; i += 1) {
    const headerText = String(sheet.getCell(0, i).values?.[0]?.[0] ?? "");
    let width = 18;
    if (/说明|备注|建议|原因|回答|完整|话术|规则|用途|来源/.test(headerText)) width = 36;
    if (/路径|内容|OCR|正文/.test(headerText)) width = 44;
    if (/编号|状态|等级|类型|日期|优先级|负责人/.test(headerText)) width = 14;
    widths.push(width);
  }
  widths.forEach((width, i) => {
    sheet.getRange(`${colLetter(i)}:${colLetter(i)}`).format.columnWidth = width;
  });
  if (rowCount > 1) {
    sheet.getRange(`A2:${colLetter(colCount - 1)}${rowCount}`).format.rowHeightPx = 52;
  }
}

function addTableIfPossible(sheet, code, rowCount, colCount) {
  if (rowCount < 1 || colCount < 1) return;
  const range = `A1:${colLetter(colCount - 1)}${Math.max(rowCount, 2)}`;
  const table = sheet.tables.add(range, true, safeTableName(code));
  table.showFilterButton = true;
  table.showBandedColumns = false;
  table.style = "TableStyleMedium2";
}

const workbook = Workbook.create();

const overview = workbook.worksheets.add("导入总览");
const summaryRows = [
  ["项目", "内容"],
  ["生成日期", "2026-06-30"],
  ["规范表来源", payload.summary.spec_xlsx],
  ["知识库来源", payload.summary.vault_root],
  ["Markdown文件数", payload.summary.note_count],
  ["说明", "每个业务表 sheet 的前置列严格来自规范表 02_字段字典，末尾来源列用于人工复核和追溯。"],
  ["注意", "自动抽取内容需业务负责人复核后再发布；T07 当前未在 vault 中发现可直接映射的供应链能力条目，仅保留空模板。"],
  ["", ""],
  ["表编号", "Sheet", "业务表", "导入行数", "字段数", "MVP阶段", "敏感级别"],
];

for (const table of payload.tables) {
  const code = table["表编号"];
  const sheetName = payload.sheet_title_by_code[code] ?? code;
  const rows = payload.rows_by_table[code] ?? [];
  const fields = payload.fields_by_table[code] ?? [];
  summaryRows.push([
    code,
    sheetName,
    table["业务表"] ?? "",
    rows.length,
    fields.length,
    table["MVP阶段"] ?? "",
    table["敏感级别"] ?? "",
  ]);
}

overview.getRangeByIndexes(0, 0, summaryRows.length, 7).values = summaryRows;
overview.showGridLines = false;
overview.freezePanes.freezeRows(9);
overview.getRange("A1:B1").format = { fill: "#1F4E5F", font: { bold: true, color: "#FFFFFF" } };
overview.getRange("A9:G9").format = { fill: "#1F4E5F", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
overview.getRange(`A1:G${summaryRows.length}`).format = { font: { name: "Arial", size: 10 }, wrapText: true, verticalAlignment: "top" };
overview.getRange("A:A").format.columnWidth = 18;
overview.getRange("B:B").format.columnWidth = 36;
overview.getRange("C:C").format.columnWidth = 34;
overview.getRange("D:G").format.columnWidth = 14;
overview.getRange(`A9:G${summaryRows.length}`).format.borders = { preset: "all", style: "thin", color: "#E5E7EB" };

for (const table of payload.tables) {
  const code = table["表编号"];
  const sheetName = payload.sheet_title_by_code[code] ?? code;
  const sheet = workbook.worksheets.add(sheetName);
  const fields = payload.fields_by_table[code] ?? [];
  const fieldHeaders = fields.map((field) => field["字段名称"]);
  const headers = [...fieldHeaders, ...payload.meta_columns];
  const rows = payload.rows_by_table[code] ?? [];
  const matrix = matrixFromRows(headers, rows);
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;
  applySheetStyle(sheet, matrix.length, headers.length);
  addTableIfPossible(sheet, code, matrix.length, headers.length);
}

const dictSheet = workbook.worksheets.add("字段字典_原规范");
const dictHeaders = ["表编号", "业务表", "字段模块", "字段名称", "字段类型", "是否必填", "字段说明", "示例", "优先级", "负责人", "入库来源", "AI用途"];
const dictRows = [];
for (const [code, fields] of Object.entries(payload.fields_by_table)) {
  for (const field of fields) {
    dictRows.push(dictHeaders.map((header) => field[header] ?? ""));
  }
}
dictSheet.getRangeByIndexes(0, 0, dictRows.length + 1, dictHeaders.length).values = [dictHeaders, ...dictRows];
applySheetStyle(dictSheet, dictRows.length + 1, dictHeaders.length);
addTableIfPossible(dictSheet, "DICT", dictRows.length + 1, dictHeaders.length);

await fs.mkdir(path.join(outDir, "previews"), { recursive: true });
for (const sheetName of ["导入总览", ...Object.values(payload.sheet_title_by_code), "字段字典_原规范"]) {
  const preview = await workbook.render({
    sheetName,
    range: "A1:K20",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(path.join(outDir, "previews", `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errorScan.ndjson);

const overviewInspect = await workbook.inspect({
  kind: "table",
  range: "导入总览!A9:G20",
  include: "values",
  tableMaxRows: 20,
  tableMaxCols: 7,
});
console.log(overviewInspect.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputXlsx);
console.log(outputXlsx);
