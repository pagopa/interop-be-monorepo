import { FileManager, logger, Logger } from "pagopa-interop-commons";
import { Message } from "@aws-sdk/client-sqs";
import { format } from "date-fns";
import {
  SqsSafeStorageBody,
  SqsSafeStorageBodySchema,
} from "../models/sqsSafeStorageBody.js";
import { config } from "../config/config.js";
import { DbServiceBuilder } from "../services/dynamoService.js";
import { SafeStorageService } from "../services/safeStorageClient.js";

async function processMessage(
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  message: SqsSafeStorageBody,
  safeStorageService: SafeStorageService,
  logger: Logger
): Promise<void> {
  try {
    const fileKey = message.detail.key;
    const fileRef = await safeStorageService.getFile(fileKey);

    if (!fileRef.download?.url) {
      logger.error(
        `File reference for key "${fileKey}" is missing download URL`
      );
      throw new Error(`Cannot process file without a download URL`);
    }

    const fileContent = await safeStorageService.downloadFileContent(
      fileRef.download.url
    );

    const clientShortCode = message.detail.client_short_code;
    const date = new Date(message.time);
    const datePath = format(date, "yyyy/MM/dd");

    const path = `${clientShortCode}/${datePath}`;
    const fileName = fileKey;

    const key = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path,
        name: fileName,
        content: fileContent,
      },
      logger
    );

    logger.info(`File successfully saved in S3 with key: ${key}`);

    await dbService.deleteFromDynamo(message.id);
    logger.info(`Record ${message.id} deleted from DynamoDB`);
  } catch (error) {
    logger.error(`Error processing message: ${String(error)}`);
    throw error;
  }
}

export const sqsMessageHandler = async (
  messagePayload: Message,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorageService: SafeStorageService
): Promise<void> => {
  const logInstance: Logger = logger({ serviceName: config.serviceName });

  try {
    if (!messagePayload.Body) {
      throw new Error("Missing SQS message body");
    }

    logInstance.info(`Message Payload Body: ${messagePayload.Body}`);
    const parsed = SqsSafeStorageBodySchema.safeParse(
      JSON.parse(messagePayload.Body)
    );
    logInstance.info(`parsed: ${JSON.stringify(parsed.data)}`);
    if (!parsed.success) {
      logInstance.error(`Invalid SQS message: ${parsed.error.message}`);
      throw new Error("Invalid SQS payload");
    }

    const validatedMessage = parsed.data;

    await processMessage(
      fileManager,
      dbService,
      validatedMessage,
      safeStorageService,
      logInstance
    );
  } catch (err) {
    logInstance.error(`Error handling SQS message: ${String(err)}`);
    throw err;
  }
};
