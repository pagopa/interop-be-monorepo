import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";

import { ErrorMessage } from "../models/index.js";

const requiredHeaders = [
  "process",
  "error",
  "bff endpoint",
  "copy it",
  "copy en",
] as const;

export function readCsvErrorFile(
  filePath: string
): Array<Omit<ErrorMessage, "errorCode">> {
  const rows: string[][] = parse(readFileSync(filePath, "utf8"), {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  // Spreadsheet exports can contain metadata rows before the actual header.
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => cell.trim().toLowerCase());
    return requiredHeaders.every((header) => headers.includes(header));
  });
  if (headerIndex === -1) {
    throw new Error(
      `Missing CSV header row. Required columns: ${requiredHeaders.join(", ")}`
    );
  }

  const headers = rows[headerIndex].map((cell) => cell.trim().toLowerCase());
  const [processIndex, errorIndex, endpointIndex, itIndex, enIndex] =
    requiredHeaders.map((header) => headers.indexOf(header));

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => ({
      process: row[processIndex] ?? "",
      error: row[errorIndex] ?? "",
      bffEndpoint: row[endpointIndex] ?? "",
      copy: {
        it: row[itIndex] ?? "",
        en: row[enIndex] ?? "",
      },
    }));
}
