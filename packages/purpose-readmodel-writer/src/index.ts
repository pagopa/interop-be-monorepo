/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  ReadModelRepository,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { PurposeEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV1 } from "./purposeConsumerServiceV1.js";
import { handleMessageV2 } from "./purposeConsumerServiceV2.js";
import { config } from "./utilities/config.js";

const { purposes } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, PurposeEvent);

  const loggerInstance = logger({
    serviceName: "purpose-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });
  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg, purposes))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, purposes))
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.purposeTopic], processMessage);
