import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateErrorMessages } from "pagopa-interop-error-message-parser";

import {
  getRootPath,
  loadErrorMessages,
  getErrorCodeAndProcessCode,
  extractRouterEndpointsFromFolder,
} from "../utils/index.js";

export async function validate({
  csvPath,
  generatedPath,
}: {
  csvPath: string;
  generatedPath: string;
}) {
  const root = getRootPath();
  const fullCsvPath = join(root, csvPath);
  if (!existsSync(fullCsvPath)) {
    throw new Error(`${fullCsvPath} not found`);
  }
  const fullGeneratedPath = join(root, generatedPath);
  if (!existsSync(fullGeneratedPath)) {
    throw new Error(`${fullGeneratedPath} not found`);
  }
  const errorMessages = await loadErrorMessages(fullGeneratedPath);
  const bffEndpoints = extractRouterEndpointsFromFolder(
    join(root, "packages", "backend-for-frontend", "src", "routers")
  );
  for (const errorMessage of errorMessages) {
    getErrorCodeAndProcessCode(errorMessage.errorCode, errorMessage.error);
    if (!bffEndpoints.includes(errorMessage.bffEndpoint)) {
      throw new Error(
        `${errorMessage.bffEndpoint} was not found among the routers`
      );
    }
  }
  const generatedContent = readFileSync(fullGeneratedPath, {
    encoding: "utf8",
  });
  const regeneratedContent = generateErrorMessages(fullCsvPath);
  if (generatedContent !== regeneratedContent) {
    throw new Error(
      `${fullGeneratedPath} does not match the content from ${fullCsvPath}, please regenerate it`
    );
  }
}
