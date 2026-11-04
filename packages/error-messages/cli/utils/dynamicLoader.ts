import path from "node:path";
import { pathToFileURL } from "node:url";

import { FullErrors } from "../models/index.js";

export async function loadErrorMessages(filePath: string): Promise<FullErrors> {
  const fileUrl = pathToFileURL(path.resolve(filePath)).href;
  const module: unknown = await import(fileUrl);

  if (
    typeof module !== "object" ||
    module === null ||
    !("errorMessages" in module)
  ) {
    throw new Error(`File ${filePath} does not export "errorMessages"`);
  }

  return FullErrors.parse(module.errorMessages);
}
