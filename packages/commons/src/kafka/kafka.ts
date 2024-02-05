import { z } from "zod";
import { KafkaMessage } from "kafkajs";
import { Message } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function decodeKafkaMessage<TEvent extends z.ZodType>(
  message: KafkaMessage,
  event: TEvent
) {
  const parsed = Message(event).safeParse(message);
  if (!parsed.success) {
    throw new Error("Invalid message: " + JSON.stringify(parsed.error));
  } else if (!parsed.data.value?.after) {
    throw new Error(
      "Invalid message: missing value " + JSON.stringify(parsed.data)
    );
  }
  return parsed.data.value.after;
}
