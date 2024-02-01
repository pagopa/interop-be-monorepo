import { EachMessagePayload } from "kafkajs";
import {
  logger,
  consumerConfig,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { EServiceEvent } from "pagopa-interop-models";

async function processMessage({
  topic,
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    const decodedMessage = decodeKafkaMessage(message, EServiceEvent);
    logger.info(`Event handled: ${JSON.stringify(decodedMessage.type)}`);
    logger.info(`Event from topic: ${JSON.stringify(topic)}`);
    logger.info(
      `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

const config = consumerConfig();
await runConsumer(config, processMessage).catch(logger.error);
