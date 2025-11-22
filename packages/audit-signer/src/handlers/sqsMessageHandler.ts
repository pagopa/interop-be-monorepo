import path from "path";
import {
  FileManager,
  logger,
  Logger,
  SafeStorageService,
  FileCreationRequest,
  SignatureServiceBuilder,
  formatError,
} from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import {
  CorrelationId,
  generateId,
  genericInternalError,
} from "pagopa-interop-models";
import { config } from "../config/config.js";
import { decodeSQSEventMessage } from "../utils/decodeSQSEventMessage.js";
import { gzipBuffer } from "../utils/compression.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

// eslint-disable-next-line max-params
async function processMessage(
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  s3Key: string,
  safeStorageService: SafeStorageService,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  try {
    const file: Uint8Array = await fileManager.get(
      config.s3Bucket,
      s3Key,
      logger
    );

    const fileName = path.basename(s3Key);
    const zipped = await gzipBuffer(file);
    const checksum = await calculateSha256Base64(zipped);

    const safeStorageRequest: FileCreationRequest = {
      contentType: "application/gzip",
      documentType: config.safeStorageDocType,
      status: config.safeStorageDocStatus,
      checksumValue: checksum,
    };

    const { uploadUrl, secret, key } = await safeStorageService.createFile(
      safeStorageRequest,
      logger
    );

    await safeStorageService.uploadFileContent(
      uploadUrl,
      zipped,
      "application/gzip",
      secret,
      checksum,
      logger
    );

    await signatureService.saveSignatureReference(
      {
        safeStorageId: key,
        fileKind: "VOUCHER_AUDIT",
        fileName,
        correlationId,
      },
      logger
    );
  } catch (error) {
    logger.error(`Error processing message: ${String(error)}`);
    throw error;
  }
}

export const sqsMessageHandler = async (
  messagePayload: Message,
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  safeStorageService: SafeStorageService
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();
  const logInstance: Logger = logger({
    serviceName: config.serviceName,
    correlationId,
  });

  try {
    const s3Key = decodeSQSEventMessage(messagePayload);
    await processMessage(
      fileManager,
      signatureService,
      s3Key,
      safeStorageService,
      logInstance,
      correlationId
    );
  } catch (err) {
    throw genericInternalError(
      `Error handling SQS message: ${formatError(err)}`
    );
  }
};
