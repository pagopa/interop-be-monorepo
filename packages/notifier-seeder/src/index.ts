import { EachMessagePayload } from "kafkajs";
import { runConsumer } from "kafka-iam-auth";
import { kafkaConsumerConfig, logger } from "pagopa-interop-commons";

const config = kafkaConsumerConfig();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    logger.info("Message handled");
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

await runConsumer(config, processMessage).catch(logger.error);
