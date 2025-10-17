/* eslint-disable max-params */
import { FileManager, Logger } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { uploadPreparedFileToS3 } from "../handlers/s3UploaderHandler.js";
import { archiveFileToSafeStorage } from "../handlers/safeStorageArchivingHandler.js";
import { AllEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { config, safeStorageApiConfig } from "../config/config.js";
import { prepareNdjsonEventData } from "./ndjsonStore.js";

/**
 * Prepares, uploads, and archives files from event data.
 *
 * @template T - The specific type of event data being processed.
 * @param allEventsToStore An array of event data.
 * @param loggerInstance A logger instance.
 * @param fileManager A file manager instance.
 * @param dbService The database service.
 * @param safeStorage The safe storage service.
 * @param correlationId A unique identifier for the request.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function processAndArchiveFiles<T extends AllEventData>(
  allEventsToStore: T[],
  loggerInstance: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService,
  correlationId: string
) {
  if (allEventsToStore.length === 0) {
    return;
  }
  try {
    const preparedFiles = await prepareNdjsonEventData<T>(
      allEventsToStore,
      loggerInstance
    );

    if (preparedFiles.length === 0) {
      throw new Error(`NDJSON preparation didn't return any files.`);
    }

    for (const preparedFile of preparedFiles) {
      const result = await uploadPreparedFileToS3(
        preparedFile,
        fileManager,
        loggerInstance,
        config
      );
      await archiveFileToSafeStorage(
        result,
        loggerInstance,
        dbService,
        safeStorage,
        safeStorageApiConfig,
        correlationId
      );
    }
  } catch (error) {
    throw genericInternalError(`Error processing archiving file: ${error}`);
  }
}
