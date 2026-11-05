import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getRootPath,
  loadErrorMessages,
  getErrorCodeAndProcessCode,
  extractRouterEndpointsFromFolder,
  findMisspelledWords,
  generateErrorMessages,
} from "../utils/index.js";

export async function validate({
  csvPath,
  generatedPath,
}: {
  csvPath: string;
  generatedPath: string;
}) {
  if (!existsSync(csvPath)) {
    throw new Error(`${csvPath} not found`);
  }
  if (!existsSync(generatedPath)) {
    throw new Error(`${generatedPath} not found`);
  }
  const errorMessages = await loadErrorMessages(generatedPath);
  const root = getRootPath();
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
  const spellingErrors: string[] = [];
  for (const { errorCode, copy } of errorMessages) {
    const misspelled = [
      ...(await findMisspelledWords(copy.it, "it")),
      ...(copy.en ? await findMisspelledWords(copy.en, "en") : []),
    ];
    if (misspelled.length > 0) {
      spellingErrors.push(`${errorCode}: ${misspelled.join(", ")}`);
    }
  }
  if (spellingErrors.length > 0) {
    throw new Error(
      `Possible spelling errors:\n${spellingErrors.join("\n")}\n\nIf you think it's a mistake, add it to packages/error-messages/cli/utils/spellcheck.ts in allowedWords`
    );
  }
  const generatedContent = readFileSync(generatedPath, {
    encoding: "utf8",
  });
  const regeneratedContent = generateErrorMessages(csvPath);
  if (generatedContent !== regeneratedContent) {
    throw new Error(
      `${generatedPath} does not match the content from ${csvPath}, please regenerate it`
    );
  }
}
