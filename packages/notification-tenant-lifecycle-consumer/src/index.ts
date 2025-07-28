import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import {
  logger,
  decodeKafkaMessage,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  generateId,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "./config/config.js";
import { notificationTenantLifecycleConsumerServiceBuilder } from "./notificationTenantLifecycleConsumerService.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);

await refreshableToken.init();

const notificationTenantLifecycleConsumerService =
  notificationTenantLifecycleConsumerServiceBuilder(
    refreshableToken,
    getInteropBeClients()
  );

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEvent);
  const correlationId = decodedMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "notification-tenant-lifecycle-consumer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decodedMessage.type} message - Partition number: ${partition}. Offset: ${message.offset}`
  );

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) =>
      notificationTenantLifecycleConsumerService.handleMessageV1(
        msg,
        correlationId,
        loggerInstance
      )
    )
    .with({ event_version: 2 }, (msg) =>
      notificationTenantLifecycleConsumerService.handleMessageV2(
        msg,
        correlationId,
        loggerInstance
      )
    )
    .exhaustive();
}

await runConsumer(
  config,
  [config.tenantTopic],
  processMessage,
  "notification-tenant-lifecycle-consumer"
);
