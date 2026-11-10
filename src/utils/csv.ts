/**
 * Minimal CSV helpers (no library needed).
 * Values are quoted when they contain commas, quotes or line breaks.
 */

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Starts a download of the CSV text in the browser. Call only from a click handler. */
export function downloadCsv(filename: string, csv: string): void {
  // The BOM (\uFEFF) makes Excel read the ₹ sign and other characters correctly.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
