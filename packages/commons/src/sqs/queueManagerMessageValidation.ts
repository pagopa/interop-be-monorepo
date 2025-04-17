import { invalidSqsMessage } from "pagopa-interop-models";
import { Logger } from "../logging/index.js";
import { Message } from "./index.js";

type EventValidation = "ValidEvent" | "InvalidEvent";

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
      logger.warn(`Skipping event - ${body.Event}`);
      return "InvalidEvent";
    }

    return "ValidEvent";
  } catch (error) {
    throw invalidSqsMessage(message.MessageId, error);
  }
};
