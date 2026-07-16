/**
 * Client-side CSV export utility.
 * Formats in-memory data as CSV and triggers a browser download.
 */

/**
 * Convert an array of objects to a CSV string.
 * @param {Array<Object>} rows - Data rows
 * @param {Array<{key: string, label: string}>} columns - Column definitions
 * @returns {string} CSV content
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvField(String(row[c.key] ?? ""))).join(","),
  );
  return [header, ...body].join("\n");
}

function escapeCsvField(value) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Trigger a CSV file download in the browser.
 * @param {string} csv - CSV content string
 * @param {string} filename - Download filename
 */
export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
