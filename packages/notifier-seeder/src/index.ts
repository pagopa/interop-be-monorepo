import { EachMessagePayload } from "kafkajs";
import { runConsumer } from "kafka-iam-auth";
import {
  kafkaConsumerConfig,
  catalogTopicConfig,
  logger,
} from "pagopa-interop-commons";

const config = kafkaConsumerConfig();
const topics = catalogTopicConfig();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  logger.info(
    `Message handled. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [topics.catalogTopic], processMessage);
