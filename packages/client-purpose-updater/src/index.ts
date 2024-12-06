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
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./clientPurposeUpdaterConsumerServiceV2.js";
import { config } from "./config/config.js";

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, PurposeEventV2);

  const loggerInstance = logger({
    serviceName: "client-purpose-updater",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  await match(decodedMessage)
    .with({ event_version: 2 }, () =>
      handleMessageV2(decodedMessage, refreshableToken)
    )
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.authorizationTopic], processMessage);
