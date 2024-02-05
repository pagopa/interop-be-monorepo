import { EachMessagePayload } from "kafkajs";
import {
  logger,
  consumerConfig,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { EServiceEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessage } from "./consumerService.js";

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    const decodedMesssage = decodeKafkaMessage(message, EServiceEvent);

    await match(decodedMesssage)
      .with({ eventVersion: 1 }, handleMessage)
      .otherwise((message) => {
        // Todo handle version 2 events
        logger.warn(`Unsupported event version: ${message.eventVersion}`);
      });

    // await handleMessage(decodeKafkaMessage(message, EServiceEvent));
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
