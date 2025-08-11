/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */

import { Logger } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { SafeStorageApiConfig } from "../config/config.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { calculateSha256Base64 } from "../utils/checksum.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const archiveFileToSafeStorage = async (
  storedFile: {
    fileContentBuffer: Buffer;
    fileName: string;
  },
  logger: Logger,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService,
  config: SafeStorageApiConfig,
  correlationId: string
): Promise<void> => {
  const { fileContentBuffer, fileName } = storedFile;

  const checksum = await calculateSha256Base64(fileContentBuffer);

  logger.info(`Requesting file creation in Safe Storage for ${fileName}`);

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
      correlationId,
    });
    logger.info(`Safe Storage reference for ${fileName} saved in DynamoDB.`);
  } catch (error) {
    throw genericInternalError(
      `Failed to process Safe Storage/DynamoDB for file ${fileName}: ${error}`
    );
  }
};
