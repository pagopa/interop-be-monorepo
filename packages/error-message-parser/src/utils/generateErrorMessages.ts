import { readCsvErrorFile } from "./csvReader.js";
import { getErrorCode } from "./parseErrorCode.js";

export function generateErrorMessages(filePath: string): string {
  const messages = readCsvErrorFile(filePath).map(
    ({ process, error, ...message }) => ({
      process,
      error,
      errorCode: getErrorCode(process, error),
      ...message,
    })
  );

  return `// Generated from the error messages CSV. Do not edit manually.
import type { ErrorMessage } from "../models/index.js";

export const errorMessages = ${JSON.stringify(messages, null, 2)} as const satisfies readonly ErrorMessage[];

export type GeneratedErrorMessage = (typeof errorMessages)[number];
`;
}
