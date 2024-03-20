import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  readModelWriterConfig,
  agreementTopicConfig,
  decodeKafkaMessage,
  logger,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { AgreementEvent } from "pagopa-interop-models";
import { handleMessage } from "./agreementConsumerService.js";

const config = readModelWriterConfig();
const { agreementTopic } = agreementTopicConfig();
const { agreements } = ReadModelRepository.init(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    await handleMessage(
      decodeKafkaMessage(message, AgreementEvent),
      agreements
    );

    logger.info(
      `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

await runConsumer(config, [agreementTopic], processMessage).catch(logger.error);
