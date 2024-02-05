import { EachMessagePayload } from "kafkajs";
import {
  logger,
  consumerConfig,
  ReadModelRepository,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { EServiceEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessage } from "./consumerService.js";

const config = consumerConfig();
const { eservices } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    const decodedMesssage = decodeKafkaMessage(message, EServiceEvent);

    await match(decodedMesssage)
      .with({ eventVersion: 1 }, (msg) => handleMessage(msg, eservices))
      .otherwise((message) => {
        // Todo handle version 2 events
        logger.warn(`Unsupported event version: ${message.eventVersion}`);
      });

    logger.info(
      `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

await runConsumer(config, processMessage).catch(logger.error);
