import { Message } from "@aws-sdk/client-sqs";

import { Logger } from "../logging/index.js";

type EventValidation = "ValidEvent" | "SkipEvent";

export const validateSqsMessage = (
  message: Message,
  logger: Logger
): EventValidation => {
  if (!message.Body) {
    throw new Error("Message body is undefined");
  }

  try {
    const body = JSON.parse(message.Body);
    if (body.Event === "s3:TestEvent") {
      logger.debug(`Skipping TestEvent - ${body.Event}`);
      return "SkipEvent";
    }

    return "ValidEvent";
  } catch (error) {
    logger.warn(
      `Skipping SQS message with id ${
        message.MessageId
      }: body is not valid JSON. Body: ${message.Body}. Error: ${error}`
    );
    return "SkipEvent";
  }
};
