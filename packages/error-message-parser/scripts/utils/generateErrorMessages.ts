import { readCsvErrorFile } from "./csvReader.js";
import { getErrorCode } from "./parseErrorCode.js";

export function generateErrorMessages(filePath: string): string {
  const messages = readCsvErrorFile(filePath)
    .map(({ process, error, ...message }) => ({
      process,
      error,
      errorCode: getErrorCode(process, error),
      ...message,
    }))
    .filter(({ errorCode }) => errorCode !== null);
  console.warn(
    `Filtered out messages with null errorCode:`,
    messages.filter(({ errorCode }) => errorCode === null)
  );

  return `// Generated from the error messages CSV. Do not edit manually.
export type ErrorMessage = {
  readonly process: string;
  readonly error: string;
  readonly errorCode: string | null;
  readonly bffEndpoint: string;
  readonly copy: {
    readonly it: string;
    readonly en: string;
  };
};

export const errorMessages = ${JSON.stringify(messages, null, 2)} as const satisfies readonly ErrorMessage[];

export type GeneratedErrorMessage = (typeof errorMessages)[number];
`;
}
