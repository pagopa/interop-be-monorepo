/* eslint-disable functional/immutable-data */

import { Logger } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { SafeStorageApiConfig } from "../config/config.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { calculateSha256Base64 } from "./checksum.js";

/**
 * Processes a list of stored file details by interacting with Safe Storage and saving references in DynamoDB.
 *
 * @param storedFiles - An array of objects containing file details (buffer, presigned URL, name).
 * @param fileManager - The file manager instance.
 * @param logger - The logger instance.
 * @param dbService - The DB service instance.
 * @param safeStorage - The Safe Storage service instance.
 * @param config - The application configuration, containing Safe Storage API details and S3 bucket.
 */
export const processStoredFilesForSafeStorage = async (
  storedFiles: Array<{
    fileContentBuffer: Buffer;
    s3PresignedUrl: string;
    fileName: string;
  }>,
  logger: Logger,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService,
  config: SafeStorageApiConfig
): Promise<void> => {
  if (storedFiles.length === 0) {
    logger.info("No files to process for Safe Storage or DynamoDB.");
    return;
  }

  for (const file of storedFiles) {
    const { fileContentBuffer, s3PresignedUrl, fileName } = file;

    const checksum = await calculateSha256Base64(fileContentBuffer);

    logger.info(
      `Requesting file creation in Safe Storage for ${s3PresignedUrl}...`
    );

    const safeStorageRequest: FileCreationRequest = {
      contentType: "application/json",
      documentType: config.safeStorageDocType,
      status: config.safeStorageDocStatus,
      checksumValue: checksum,
    };

    try {
      const { uploadUrl, secret, key } = await safeStorage.createFile(
        safeStorageRequest
      );

      await safeStorage.uploadFileContent(
        uploadUrl,
        fileContentBuffer,
        "application/json",
        secret,
        checksum
      );

      logger.info(`File ${fileName} uploaded to Safe Storage successfully.`);

      await dbService.saveSignatureReference({
        safeStorageId: key,
        fileKind: "PLATFORM_EVENTS",
        fileName,
      });
      logger.info(`Safe Storage reference for ${fileName} saved in DynamoDB.`);
    } catch (error) {
      throw genericInternalError(
        `Failed to process Safe Storage/DynamoDB for file ${fileName}: ${error}`
      );
    }
  }
};
