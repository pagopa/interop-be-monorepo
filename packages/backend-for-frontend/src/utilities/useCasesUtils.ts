import { FileManager, Logger, streamToString } from "pagopa-interop-commons";

import { BffProcessConfig } from "../config/config.js";
import { UseCasesFile, UseCasesLanguage } from "../model/types.js";

/* The frontend sends the language with its region (e.g. "it-IT", "en-EN"):
   only the primary language subtag selects the use cases file. */
export const getUseCasesLanguage = (
  acceptLanguage: string | undefined
): UseCasesLanguage => {
  const primaryLanguage = acceptLanguage
    ?.split(",")[0]
    .split("-")[0]
    .trim()
    .toLowerCase();

  return (
    UseCasesLanguage.safeParse(primaryLanguage).data ?? UseCasesLanguage.enum.it
  );
};

/* Any read or parsing error makes the caller fall back to another file,
   so it is logged and mapped to undefined. */
async function readUseCasesFile(
  fileManager: FileManager,
  config: BffProcessConfig,
  language: UseCasesLanguage,
  logger: Logger
): Promise<UseCasesFile | undefined> {
  const path = `${config.useCasesPath}/${language}/${config.useCasesFileName}`;
  try {
    const file = await fileManager.get(config.useCasesContainer, path, logger);
    return UseCasesFile.parse(JSON.parse(streamToString(file)));
  } catch (error) {
    logger.warn(`Error reading use cases file ${path}: ${error}`);
    return undefined;
  }
}

/* Reads the use cases file of the given language, falls back to the file of
   the italian language and returns no use cases if neither can be read. */
export async function getUseCases(
  fileManager: FileManager,
  config: BffProcessConfig,
  language: UseCasesLanguage,
  logger: Logger
): Promise<UseCasesFile> {
  const useCases = await readUseCasesFile(
    fileManager,
    config,
    language,
    logger
  );
  if (useCases !== undefined || language === UseCasesLanguage.enum.it) {
    return useCases ?? [];
  }

  return (
    (await readUseCasesFile(
      fileManager,
      config,
      UseCasesLanguage.enum.it,
      logger
    )) ?? []
  );
}
