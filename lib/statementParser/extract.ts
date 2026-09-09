import * as XLSX from "xlsx";

// Bank statement exports (HDFC/SBI net-banking "download statement") come as
// .xls files that are sometimes real binary/XLS-XML workbooks and sometimes
// just an HTML <table> saved with an .xls extension. We try SheetJS first
// (it handles real XLS/XLSX/CSV) and fall back to parsing the raw text as
// an HTML table when SheetJS can't find tabular data.
//
// Everything in this file talks to the browser (File, DOMParser) — kept
// separate from parse.ts, which is pure and unit-testable without a DOM.

export type StatementRow = string[];

function sheetToRows(workbook: XLSX.WorkBook): StatementRow[] {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<StatementRow>(sheet, { header: 1, raw: false, defval: "" });
}

function htmlToRows(text: string): StatementRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const rows: StatementRow[] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const cells = Array.from(tr.querySelectorAll("td,th")).map((c) =>
      (c.textContent || "").replace(/ /g, " ").trim()
    );
    if (cells.some((c) => c !== "")) rows.push(cells);
  }
  return rows;
}

export async function extractRows(file: File): Promise<StatementRow[]> {
  const buf = await file.arrayBuffer();
  try {
    const wb = XLSX.read(buf, { type: "array" });
    const rows = sheetToRows(wb);
    if (rows.length > 3) return rows;
  } catch {
    // fall through to HTML parsing
  }
  const text = new TextDecoder("utf-8").decode(buf);
  return htmlToRows(text);
}
