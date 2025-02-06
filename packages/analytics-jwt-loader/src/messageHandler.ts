import { Message } from "@aws-sdk/client-sqs";
import { FileManager, Logger, genericLogger } from "pagopa-interop-commons";
import { readFile } from "./fileReader.js";
import { sqsMessageFormatError, sqsProcessError } from "./model/errors.js";
import { S3EventSchema } from "./model/s3EventModel.js";

export function processMessage(
  queueUrl: string,
  fileManager: FileManager,
  logger: Logger,
): (message: Message) => Promise<void> {
  return async (message: Message) => {
    try {
      genericLogger.info(`Message received: ${JSON.stringify(message)}`);

      if (!message.Body) {
        throw sqsMessageFormatError(queueUrl, "Message body is empty");
      }

      const body = JSON.parse(message.Body);

      const parsedKey = S3EventSchema.safeParse(body);

      if (!parsedKey.success) {
        throw sqsMessageFormatError(
          queueUrl,
          "fileKey not found in SQS message",
        );
      }

      const fileKey = parsedKey.data.Records[0].s3.object.key;

      const fileToken = await readFile(fileKey, fileManager, logger);

      logger.info(`File token: ${fileToken}`);
    } catch (error) {
      throw sqsProcessError("unknown", error);
    }
  };
}
