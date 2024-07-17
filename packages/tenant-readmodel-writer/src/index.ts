import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  decodeKafkaMessage,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEvent } from "pagopa-interop-models";
import { config } from "./config/config.js";
import { handleMessageV1 } from "./tenantConsumerServiceV1.js";
import { handleMessageV2 } from "./tenantConsumerServiceV2.js";

const { tenants } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEvent);

  const loggerInstance = logger({
    serviceName: "tenant-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg, tenants))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, tenants))
    .exhaustive();
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.tenantTopic], processMessage);
