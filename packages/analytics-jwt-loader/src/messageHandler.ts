import { Message } from "@aws-sdk/client-sqs";
import { genericLogger } from "pagopa-interop-commons";

export function processMessage(): (message: Message) => Promise<void> {
  return async (message: Message) => {
    genericLogger.info(`message received ${JSON.stringify(message)}`);
    await Promise.resolve();
  };
}
