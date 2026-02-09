/**
 * CSV export utilities
 */

export type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV<T>(data: T[], columns: ExportColumn<T>[]): string {
  const headerRow = columns.map((col) => escapeCSVField(col.header)).join(",");

  const dataRows = data.map((row) =>
    columns
      .map((col) => {
        const value = col.accessor(row);
        if (value === null || value === undefined) return "";
        return escapeCSVField(String(value));
      })
      .join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const csv = generateCSV(data, columns);
  downloadCSV(csv, filename);
}
