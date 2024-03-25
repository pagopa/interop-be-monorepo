/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  readModelWriterConfig,
  agreementTopicConfig,
  decodeKafkaMessage,
  logger,
  getContext,
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
    const msg = decodeKafkaMessage(message, AgreementEvent);

    const ctx = getContext();
    ctx.messageData = {
      eventType: msg.type,
      eventVersion: msg.event_version,
      streamId: msg.stream_id,
    };
    ctx.correlationId = msg.correlation_id;

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
