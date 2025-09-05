// utils/fileProcessor.ts
import { FileManager, Logger } from "pagopa-interop-commons";
import { uploadPreparedFileToS3 } from "../handlers/s3UploaderHandler.js";
import { archiveFileToSafeStorage } from "../handlers/safeStorageArchivingHandler.js";
import { AllEventData } from "../models/eventTypes.js";
import { prepareNdjsonEventData } from "./ndjsonStore.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { config, safeStorageApiConfig } from "../config/config.js";

/**
 * Prepares, uploads, and archives files from event data.
 * @template T - The specific type of event data being processed.
 * @param allEventsToStore An array of event data.
 * @param loggerInstance A logger instance.
 * @param fileManager A file manager instance.
 * @param config The application configuration.
 * @param dbService The database service.
 * @param safeStorage The safe storage service.
 * @param safeStorageApiConfig The safe storage API configuration.
 * @param correlationId A unique identifier for the request.
 */
export async function processAndArchiveFiles<T extends AllEventData>(
  allEventsToStore: T[],
  loggerInstance: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService,
  correlationId: string,
) {
  if (allEventsToStore.length === 0) {
    return;
  }

  const preparedFiles = await prepareNdjsonEventData<T>(
    allEventsToStore,
    loggerInstance,
  );

  if (preparedFiles.length === 0) {
    throw new Error(`NDJSON preparation didn't return any files.`);
  }

  for (const preparedFile of preparedFiles) {
    const result = await uploadPreparedFileToS3(
      preparedFile,
      fileManager,
      loggerInstance,
      config,
    );
    await archiveFileToSafeStorage(
      result,
      loggerInstance,
      dbService,
      safeStorage,
      safeStorageApiConfig,
      correlationId,
    );
  }
}
