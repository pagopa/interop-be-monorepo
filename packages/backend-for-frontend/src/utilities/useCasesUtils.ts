import { FileManager, Logger, streamToString } from "pagopa-interop-commons";

import { BffProcessConfig } from "../config/config.js";
import { UseCasesFile, UserFacingLanguage } from "../model/types.js";

const defaultUseCasesLanguage: UserFacingLanguage = "it";

/* Any read or parsing error makes the caller fall back to another file,
   so it is logged and mapped to undefined. */
async function readUseCasesFile(
  fileManager: FileManager,
  config: BffProcessConfig,
  language: UserFacingLanguage,
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

/* Reads the use cases file of the given language (italian when missing, as
   the user messages of the errors), falls back to the italian file and
   returns no use cases if neither can be read. */
export async function getUseCases(
  fileManager: FileManager,
  config: BffProcessConfig,
  language: UserFacingLanguage | undefined,
  logger: Logger
): Promise<UseCasesFile> {
  const useCases =
    language !== undefined && language !== defaultUseCasesLanguage
      ? await readUseCasesFile(fileManager, config, language, logger)
      : undefined;

  return (
    useCases ??
    (await readUseCasesFile(
      fileManager,
      config,
      defaultUseCasesLanguage,
      logger
    )) ??
    []
  );
}
