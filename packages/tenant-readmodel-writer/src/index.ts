import { EachMessagePayload } from "kafkajs";
import {
  logger,
  decodeKafkaMessage,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEventV1 } from "pagopa-interop-models";
import { handleMessage } from "./tenantConsumerService.js";
import { config } from "./config/config.js";

const { tenants } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEventV1);

  const loggerInstance = logger({
    serviceName: "tenant-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });

  await handleMessage(decodedMessage, tenants, loggerInstance);
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.tenantTopic], processMessage);
