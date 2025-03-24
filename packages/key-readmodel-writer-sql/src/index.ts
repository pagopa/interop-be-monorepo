import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  AuthorizationEvent,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  clientJWKKeyReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";
import { handleMessageV1 } from "./keyConsumerServiceV1.js";
import { handleMessageV2 } from "./keyConsumerServiceV2.js";
import { config } from "./config/config.js";
import { customReadModelServiceBuilder } from "./readModelService.js";

const db = makeDrizzleConnection(config);
const producerJWKKeyReadModelService = clientJWKKeyReadModelServiceBuilder(db);
const readModelService = customReadModelServiceBuilder(
  db,
  producerJWKKeyReadModelService
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AuthorizationEvent);

  const loggerInstance = logger({
    serviceName: "key-readmodel-writer-sql",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });
  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg, readModelService))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, readModelService))
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.authorizationTopic], processMessage);
