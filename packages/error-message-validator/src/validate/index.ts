import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getRootPath,
  loadErrorMessages,
  getErrorCodeAndProcessCode,
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
  // TODO: Get endpoint list
  for (const errorMessage of errorMessages) {
    getErrorCodeAndProcessCode(errorMessage.errorCode, errorMessage.error);
    // TODO: Check endpoint exists
  }
  // TODO: Check generated is equal to new generated from csv
}
