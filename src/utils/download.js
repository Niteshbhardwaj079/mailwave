/**
 * Small download helpers. Everything is built in the browser, so nothing
 * needs a server — handy while the backend is not connected yet.
 */

function triggerDownload(blob, filename) {
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

function escapeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
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

/** Turn a list of objects into rows using the given column keys. */
export function objectsToRows(items, columns) {
  const header = columns.map((column) => column.label);
  const body = items.map((item) => columns.map((column) => item[column.key]));
  return [header, ...body];
}
