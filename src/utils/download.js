/**
 * Small download helpers. Everything is built in the browser, so nothing
 * needs a server — handy while the backend is not connected yet.
 */

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a moment to start the download before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Contacts/subscribers often come from an imported list, not typed by hand —
 * so a cell can contain whatever that list contained. If a name/company/city
 * starts with =, +, -, @ (or a tab/CR), Excel and Google Sheets treat the
 * cell as a FORMULA the moment the file is opened, not as text. That is the
 * well-known "CSV injection" trick: an imported row named
 * `=HYPERLINK("http://evil","click")` would turn into a live link/formula in
 * whoever's spreadsheet opens the export.
 *
 * Prefixing such a value with a plain apostrophe is the standard fix — every
 * spreadsheet app then shows the text as-is instead of evaluating it.
 */
function neutralizeFormula(text) {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function escapeCell(value) {
  const text = neutralizeFormula(value === null || value === undefined ? '' : String(value));
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * rows: array of arrays. The first row is treated as the header.
 * The BOM at the front makes Excel open Hindi/Gujarati/Arabic text correctly.
 */
export function downloadCsv(filename, rows) {
  const body = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * rows: array of arrays, first row is the header. Asli .xlsx file banata hai —
 * ExcelJS sirf tabhi load hoti hai jab koi Excel format chunta hai, warna
 * bekaar hi 1 MB har page load par nahi aati.
 */
export async function downloadXlsx(filename, rows) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  // ExcelJS stores plain strings as text (not evaluated as a formula), but we
  // neutralize the same way as the CSV export anyway — belt and suspenders
  // against any spreadsheet app that guesses cell type from content.
  rows.forEach((row) => sheet.addRow(row.map((cell) => (typeof cell === 'string' ? neutralizeFormula(cell) : cell))));
  if (rows.length) sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = Math.min(
      40,
      Math.max(10, ...column.values.filter(Boolean).map((value) => String(value).length))
    );
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename);
}

/** Turn a list of objects into rows using the given column keys. */
export function objectsToRows(items, columns) {
  const header = columns.map((column) => column.label);
  const body = items.map((item) => columns.map((column) => item[column.key]));
  return [header, ...body];
}
