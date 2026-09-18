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

  // Exclude the first row and keep only the first x columns
  const filteredRows = rows
    .slice(1)
    .map((row: string[]) => row.slice(0, 3 + languages.length));

  const parsed: ErrorCopy = {};

  for (const row of filteredRows) {
    // Implement the logic to populate the ErrorCopy object based on the row data
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
    if (!parsed[url]) {
      parsed[url] = {};
    }

    const messages = ErrorMessage.safeParse(
      Object.fromEntries(
        languages.map((lang, idx) => [lang, row.at(3 + idx)?.trim()])
      )
    );
    if (!messages.success) {
      continue;
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
