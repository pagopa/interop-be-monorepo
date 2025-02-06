import { Message } from "@aws-sdk/client-sqs";
import { FileManager, Logger, genericLogger } from "pagopa-interop-commons";
import { readFile } from "./fileReader.js";
import { sqsMessageFormatError, sqsProcessError } from "./model/errors.js";

export function processMessage(
  queueUrl: string,
  fileManager: FileManager,
  logger: Logger
): (message: Message) => Promise<void> {
  return async (message: Message) => {
    try {
      genericLogger.info(`Message received: ${JSON.stringify(message)}`);

      if (!message.Body) {
        throw sqsMessageFormatError(queueUrl, "Message body is empty");
      }

      const body = JSON.parse(message.Body);

      const fileKey = body.Records?.[0]?.s3?.object?.key;
      if (!fileKey) {
        throw sqsMessageFormatError(
          queueUrl,
          "fileKey not found in SQS message"
        );
      }

      logger.info(`Processing file: ${fileKey}`);

      const fileToken = await readFile(fileKey, fileManager, logger);
      logger.info(`File token: ${fileToken}`);
    } catch (error) {
      throw sqsProcessError("unknown", error);
    }
  };
}
