import { Message } from "@aws-sdk/client-sqs";
import { logger } from "pagopa-interop-commons";

import { config } from "../config/config.js";
import { KafkaProducer } from "../models/kafka.js";
import { decodeSQSMessage } from "../models/queue.js";

export function handleMessage(producer: KafkaProducer) {
  return async function processMessage(message: Message): Promise<void> {
    const decodedMessage = decodeSQSMessage(message);

    const loggerInstance = logger({
      serviceName: config.serviceName,
      spanId: decodedMessage.spanId,
      correlationId: decodedMessage.correlationId,
    });

    await producer.send({
      messages: [
        {
          key: decodedMessage.correlationId,
          value: JSON.stringify(decodedMessage),
        },
      ],
    });

    loggerInstance.info(
      "Application audit sent to Kafka topic through fallback path"
    );
  };
}
