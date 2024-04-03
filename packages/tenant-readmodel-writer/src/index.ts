import { EachMessagePayload } from "kafkajs";
import {
  logger,
  readModelWriterConfig,
  tenantTopicConfig,
  decodeKafkaMessage,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { TenantEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./tenantConsumerServiceV2.js";
import { handleMessageV1 } from "./tenantConsumerServiceV1.js";

const config = readModelWriterConfig();
const { tenants } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    // await handleMessage(decodeKafkaMessage(message, TenantEventV1));
    const decodedMesssage = decodeKafkaMessage(message, TenantEvent);

    await match(decodedMesssage)
      .with({ event_version: 1 }, (msg) => handleMessageV1(msg))
      .with({ event_version: 2 }, (msg) => handleMessageV2(msg, tenants))
      .exhaustive();
    logger.info(
      `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

const { tenantTopic } = tenantTopicConfig();
await runConsumer(config, [tenantTopic], processMessage).catch(logger.error);
