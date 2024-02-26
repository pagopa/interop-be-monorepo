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
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";

const config = consumerConfig();
const { eservices } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    const decodedMesssage = decodeKafkaMessage(message, EServiceEvent);

    await match(decodedMesssage)
      .with({ event_version: 1 }, (msg) => handleMessageV1(msg, eservices))
      .with({ event_version: 2 }, (msg) => handleMessageV2(msg, eservices))
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

await runConsumer(config, processMessage).catch(logger.error);
