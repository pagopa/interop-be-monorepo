import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import { AttributeEvent } from "pagopa-interop-models";
import { runConsumer } from "kafka-iam-auth";
import { handleMessage } from "./attributeRegistryConsumerService.js";
import { config } from "./utilities/config.js";

const { attributes } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AttributeEvent);

  const loggerInstance = logger({
    serviceName: "attribute-registry-readmodel-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });

  await handleMessage(decodedMessage, attributes);

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.attributeTopic], processMessage);
