import { join } from "node:path";

import { readCsvErrorFile } from "./csvReader.js";
import { extractRouterEndpointsFromFolder, getRootPath } from "./index.js";
import { getErrorCode } from "./parseErrorCode.js";

export function generateErrorMessages(filePath: string): string {
  const root = getRootPath();
  const bffEndpoints = extractRouterEndpointsFromFolder(
    join(root, "packages", "backend-for-frontend", "src", "routers")
  );
  const messages = readCsvErrorFile(filePath)
    .map(({ process, error, ...message }) => ({
      process,
      error,
      errorCode: getErrorCode(process, error),
      ...message,
    }))
    .filter(({ errorCode, process, error, bffEndpoint }) => {
      if (errorCode === null) {
        console.warn("Skipping error message with unresolved error code", {
          process,
          error,
        });
        return false;
      }
      if (!bffEndpoints.includes(bffEndpoint)) {
        console.warn("Skipping error message with missing BFF endpoint", {
          process,
          error,
          bffEndpoint,
        });
        return false;
      }

      return true;
    });

  return `// Generated from the error messages CSV. Do not edit manually.
import type { ErrorMessage } from "pagopa-interop-models";

export const errorMessages = ${JSON.stringify(messages, null, 2)} as const satisfies readonly ErrorMessage[];

export type GeneratedErrorMessage = (typeof errorMessages)[number];
`;
}
