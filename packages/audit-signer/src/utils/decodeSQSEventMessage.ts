import { genericInternalError } from "pagopa-interop-models";
import { Message } from "@aws-sdk/client-sqs";
import { S3BodySchema } from "../models/s3BodySchema.js";

export function decodeSQSEventMessage(message: Message): string {
  try {
    if (!message.Body) {
      throw new Error("Message body is undefined");
    }

    const s3Body: S3BodySchema = JSON.parse(message.Body);
    if (!s3Body.Records.length) {
      throw new Error("S3Body doesn't contain records");
    }

    return s3Body.Records[0].s3.object.key;
  } catch (error: unknown) {
    throw genericInternalError(
      `Failed to decode SQS S3 event message with MessageId: ${message.MessageId}. Details: ${error}`
    );
  }
}
