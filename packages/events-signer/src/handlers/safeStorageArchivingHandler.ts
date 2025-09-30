/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */

import {
  Logger,
  SafeStorageApiConfig,
  SafeStorageService,
  FileCreationRequest,
  DbServiceBuilder,
  SignatureReference,
} from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { calculateSha256Base64 } from "../utils/checksum.js";

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

    const signatureReference = {
      safeStorageId: key,
      fileKind: "EVENT_JOURNAL",
      fileName,
      correlationId,
    } as SignatureReference;

    await dbService.saveSignatureReference(signatureReference);
    logger.info(`Safe Storage reference for ${fileName} saved in DynamoDB.`);
  } catch (error) {
    throw genericInternalError(
      `Failed to process Safe Storage/DynamoDB for file ${fileName}: ${error}`
    );
  }
};
