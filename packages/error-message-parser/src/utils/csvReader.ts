import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";

import {
  ErrorCopy,
  MethodUrl,
  ProcessName,
  ErrorMessage,
} from "../models/index.js";
import { getErrorCode } from "./parseErrorCode.js";

const columns = {
  process: 0,
  errorCode: 1,
  methodUrl: 2,
} as const;

export function readCsvErrorFile(
  filePath: string,
  languages: string[]
): ErrorCopy {
  const content = readFileSync(filePath, "utf8");

  const rows = parse(content, {
    skip_empty_lines: true,
  });

  const headers = rows[0];

  // Find all the columns that have "{language}" or "Copy {language}" in the header, in the exact order of the languages array
  const languageColumnsIndexes = languages
    .map<number | undefined>((lang) => {
      const exactMatch = headers.findIndex(
        (header) => header.trim().toLowerCase() === lang.toLowerCase()
      );
      if (exactMatch !== -1) {
        return exactMatch;
      }
      const copyMatch = headers.findIndex(
        (header) => header.trim().toLowerCase() === `copy ${lang.toLowerCase()}`
      );
      return copyMatch !== -1 ? copyMatch : undefined;
    })
    .filter((res) => res !== undefined);

  // Exclude the first row and keep only the first three columns + the language columns
  const filteredRows = rows.slice(1).map((row: string[]) => {
    const fixedColumns = row.slice(0, Object.keys(columns).length);

    return [
      ...fixedColumns,
      ...(languageColumnsIndexes as number[]).map((idx) => row.at(idx)),
    ];
  });

  const parsed: ErrorCopy = {};

  for (const row of filteredRows) {
    const urlParse = MethodUrl.safeParse(row.at(columns.methodUrl));
    const processParse = ProcessName.safeParse(row.at(columns.process));
    const errorCode = row.at(columns.errorCode);
    if (!urlParse.success || !processParse.success || !errorCode) {
      continue;
    }

    const url = urlParse.data;
    const process = processParse.data;
    const parsedErrorCode = getErrorCode(process, errorCode);
    if (!parsedErrorCode) {
      continue;
    }

    const messages = ErrorMessage.safeParse(
      Object.fromEntries(
        languages.map((lang, idx) => [lang, row.at(3 + idx)?.trim()])
      )
    );
    if (!messages.success) {
      continue;
    }

    if (!parsed[url]) {
      parsed[url] = {};
    }
    if (!parsed[url][parsedErrorCode]) {
      parsed[url][parsedErrorCode] = {
        key: parsedErrorCode,
        messages: messages.data,
      };
    }
  }
  return parsed;
}
