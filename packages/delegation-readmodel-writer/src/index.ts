import { EachMessagePayload } from "kafkajs";
import {
  logger,
  ReadModelRepository,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { DelegationEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./delegationConsumerServiceV2.js";
import { config } from "./config/config.js";

const { delegations } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, DelegationEvent);

  const loggerInstance = logger({
    serviceName: "delegation-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });

  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, delegations))
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.delegationTopic], processMessage);
