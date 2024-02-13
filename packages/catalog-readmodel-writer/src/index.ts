import { EachMessagePayload } from "kafkajs";
import {
  logger,
  consumerConfig,
  ReadModelRepository,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";

import { EServiceEvent } from "pagopa-interop-models";
import { handleMessage } from "./consumerService.js";

const config = consumerConfig();
const { eservices } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    await handleMessage(decodeKafkaMessage(message, EServiceEvent), eservices);
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
