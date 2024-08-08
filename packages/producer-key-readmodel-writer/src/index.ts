import { EachMessagePayload } from "kafkajs";
import {
  logger,
  ReadModelRepository,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { AuthorizationEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./producerKeyConsumerServiceV2.js";
import { config } from "./config/config.js";

const { producerKeys } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AuthorizationEvent);

  const loggerInstance = logger({
    serviceName: "producer-key-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });
  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, producerKeys))
    .with({ event_version: 1 }, () => Promise.resolve())
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.authorizationTopic], processMessage);
