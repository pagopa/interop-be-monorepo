import { EachMessagePayload } from "kafkajs";
import {
  logger,
  ReadModelRepository,
  readModelWriterConfig,
  catalogTopicConfig,
  decodeKafkaMessage,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { EServiceEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";

const config = readModelWriterConfig();
const { catalogTopic } = catalogTopicConfig();
const { eservices } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, EServiceEvent);

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg, eservices))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, eservices))
    .exhaustive();

  logger.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [catalogTopic], processMessage);
